-- Fix the notification type in the trigger function to use a valid type
CREATE OR REPLACE FUNCTION public.notify_users_on_announcement()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
  publisher_name TEXT;
BEGIN
  -- Get publisher name
  SELECT CONCAT(first_name, ' ', last_name) INTO publisher_name
  FROM public.profiles
  WHERE user_id = NEW.created_by;

  -- If no publisher found, use 'System'
  IF publisher_name IS NULL THEN
    publisher_name := 'System';
  END IF;

  -- Create notification for each active user in the organization
  FOR user_record IN 
    SELECT DISTINCT p.user_id 
    FROM public.profiles p
    WHERE p.user_id IS NOT NULL
      AND (NEW.org_id IS NULL OR p.org_id = NEW.org_id)
  LOOP
    INSERT INTO public.notifications (
      user_id,
      org_id,
      title,
      message,
      type,
      link
    ) VALUES (
      user_record.user_id,
      NEW.org_id,
      NEW.title,
      CONCAT('New announcement from ', publisher_name, ': ', LEFT(NEW.content, 100)),
      'info',
      '/notifications'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;