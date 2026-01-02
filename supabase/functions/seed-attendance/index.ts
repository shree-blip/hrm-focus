import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple seeded random number generator (Mulberry32)
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Get random number in range using seeded RNG
function randomInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Check if date is a weekday
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

// Get all weekdays in a month
function getWeekdaysInMonth(year: number, month: number): Date[] {
  const weekdays: Date[] = [];
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    if (isWeekday(date)) {
      weekdays.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  
  return weekdays;
}

// Format time to ISO string with timezone
function formatDateTime(date: Date, hours: number, minutes: number): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email")
      .eq("status", "active");

    if (empError) {
      throw new Error(`Failed to fetch employees: ${empError.message}`);
    }

    console.log(`Found ${employees.length} employees`);

    // Fixed seed for reproducibility
    const SEED = 20250101;
    const rng = mulberry32(SEED);

    const attendanceRecords: any[] = [];
    
    // Generate data for each employee
    for (let empIndex = 0; empIndex < employees.length; empIndex++) {
      const employee = employees[empIndex];
      
      // Use employee index as additional seed variation
      const empRng = mulberry32(SEED + empIndex * 1000);
      
      // For each month in 2025 (0-11)
      for (let month = 0; month < 12; month++) {
        const weekdays = getWeekdaysInMonth(2025, month);
        
        // Randomly select 18-22 workdays per month
        const numWorkdays = randomInRange(empRng, 18, Math.min(22, weekdays.length));
        
        // Shuffle weekdays and take first numWorkdays
        const shuffled = [...weekdays].sort(() => empRng() - 0.5);
        const selectedDays = shuffled.slice(0, numWorkdays).sort((a, b) => a.getTime() - b.getTime());
        
        for (const day of selectedDays) {
          // Clock-in: 09:00 - 10:15 (540-615 minutes from midnight)
          const clockInMinutes = randomInRange(empRng, 540, 615);
          const clockInHour = Math.floor(clockInMinutes / 60);
          const clockInMin = clockInMinutes % 60;
          
          // Clock-out: 17:30 - 19:15 (1050-1155 minutes from midnight)
          const clockOutMinutes = randomInRange(empRng, 1050, 1155);
          const clockOutHour = Math.floor(clockOutMinutes / 60);
          const clockOutMin = clockOutMinutes % 60;
          
          // Random break: 0, 15, 30, 45, or 60 minutes
          const breakOptions = [0, 15, 30, 45, 60];
          const breakMinutes = breakOptions[randomInRange(empRng, 0, 4)];
          
          attendanceRecords.push({
            employee_id: employee.id,
            user_id: employee.id, // Use employee id as user_id placeholder
            clock_in: formatDateTime(day, clockInHour, clockInMin),
            clock_out: formatDateTime(day, clockOutHour, clockOutMin),
            clock_type: "payroll",
            status: "completed",
            total_break_minutes: breakMinutes,
            location_name: "Office",
          });
        }
      }
    }

    console.log(`Generated ${attendanceRecords.length} attendance records`);

    // Delete existing 2025 attendance data (to allow re-running)
    const { error: deleteError } = await supabase
      .from("attendance_logs")
      .delete()
      .gte("clock_in", "2025-01-01T00:00:00Z")
      .lte("clock_in", "2025-12-31T23:59:59Z");

    if (deleteError) {
      console.warn("Delete warning:", deleteError.message);
    }

    // Insert in batches of 500
    const batchSize = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < attendanceRecords.length; i += batchSize) {
      const batch = attendanceRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("attendance_logs")
        .insert(batch);
      
      if (insertError) {
        throw new Error(`Failed to insert batch ${i / batchSize}: ${insertError.message}`);
      }
      
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount} / ${attendanceRecords.length} records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Seeded ${attendanceRecords.length} attendance records for ${employees.length} employees`,
        employeeCount: employees.length,
        recordCount: attendanceRecords.length,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
