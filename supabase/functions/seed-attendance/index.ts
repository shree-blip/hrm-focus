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

// Get all weekdays between two dates
function getWeekdaysBetween(startDate: Date, endDate: Date): Date[] {
  const weekdays: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    if (isWeekday(current)) {
      weekdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return weekdays;
}

// Format time to ISO string
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

    // Get all active employees with their profile user_id
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select(`
        id, 
        first_name, 
        last_name, 
        email,
        profile_id,
        profiles!employees_profile_id_fkey (
          user_id
        )
      `)
      .eq("status", "active");

    if (empError) {
      throw new Error(`Failed to fetch employees: ${empError.message}`);
    }

    console.log(`Found ${employees?.length || 0} active employees`);

    // Fixed seed for reproducibility
    const SEED = 20250101;
    
    const attendanceRecords: {
      employee_id: string;
      user_id: string;
      clock_in: string;
      clock_out: string;
      clock_type: string;
      status: string;
      total_break_minutes: number;
      location_name: string;
    }[] = [];
    
    // Date range: Jan 1, 2025 to today
    const startDate = new Date(2025, 0, 1); // January 1, 2025
    const endDate = new Date(); // Today
    endDate.setDate(endDate.getDate() - 1); // Exclude today (so users can clock in today)
    
    const allWeekdays = getWeekdaysBetween(startDate, endDate);
    console.log(`Processing ${allWeekdays.length} weekdays from ${startDate.toDateString()} to ${endDate.toDateString()}`);

    // Generate data for each employee
    for (let empIndex = 0; empIndex < (employees?.length || 0); empIndex++) {
      const employee = employees![empIndex];
      
      // Get user_id from profile, or use employee id as fallback for seed data
      const profileData = employee.profiles as unknown;
      let userId: string | null = null;
      
      if (Array.isArray(profileData) && profileData.length > 0) {
        userId = (profileData[0] as { user_id: string }).user_id;
      } else if (profileData && typeof profileData === 'object' && profileData !== null) {
        const prof = profileData as { user_id?: string };
        userId = prof.user_id || null;
      }
      
      // Use employee id as fallback for employees without profiles
      // This allows seeding attendance data for demo purposes
      const finalUserId: string = userId || employee.id;
      
      // Use employee index as additional seed variation
      const empRng = mulberry32(SEED + empIndex * 1000);
      
      // For each weekday, generate an 8-hour workday
      for (const day of allWeekdays) {
        // Skip some days randomly (attendance rate ~90-95%)
        if (empRng() > 0.93) {
          continue; // Skip this day (absence)
        }
        
        // Clock-in: between 8:00 AM and 9:30 AM (randomized)
        const clockInMinutes = randomInRange(empRng, 480, 570); // 480 = 8:00 AM, 570 = 9:30 AM
        const clockInHour = Math.floor(clockInMinutes / 60);
        const clockInMin = clockInMinutes % 60;
        
        // Clock-out: exactly 8 hours after clock-in (no break deduction for simplicity)
        // Clock-out time = clock-in + 8 hours
        const clockOutMinutes = clockInMinutes + 480; // 480 minutes = 8 hours
        const clockOutHour = Math.floor(clockOutMinutes / 60);
        const clockOutMin = clockOutMinutes % 60;
        
        // No breaks for clean 8-hour days
        const breakMinutes = 0;
        
        attendanceRecords.push({
          employee_id: employee.id,
          user_id: finalUserId,
          clock_in: formatDateTime(day, clockInHour, clockInMin),
          clock_out: formatDateTime(day, clockOutHour, clockOutMin),
          clock_type: "payroll",
          status: "completed",
          total_break_minutes: breakMinutes,
          location_name: "Office",
        });
      }
    }

    console.log(`Generated ${attendanceRecords.length} attendance records`);

    // Delete all existing attendance data first
    const { error: deleteError } = await supabase
      .from("attendance_logs")
      .delete()
      .gte("clock_in", "2020-01-01T00:00:00Z");

    if (deleteError) {
      console.warn("Delete warning:", deleteError.message);
    } else {
      console.log("Deleted existing attendance data");
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
        throw new Error(`Failed to insert batch ${Math.floor(i / batchSize)}: ${insertError.message}`);
      }
      
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount} / ${attendanceRecords.length} records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Seeded ${attendanceRecords.length} attendance records for ${employees?.length || 0} employees`,
        employeeCount: employees?.length || 0,
        recordCount: attendanceRecords.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          weekdays: allWeekdays.length
        }
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
