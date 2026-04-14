import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';

export interface Course {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  intro_text: string | null;
  cover_image_url: string | null;
  price_usd: number;
  total_days: number;
  start_trigger: 'on_purchase' | 'fixed_date' | 'ash_wednesday' | 'first_sunday_advent';
  start_date: string | null;
  published: boolean;
  featured: boolean;
}

export interface CourseEnrollment {
  id: string;
  course_slug: string;
  email: string;
  started_on: string | null;
  last_sent_day: number;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled' | 'failed';
  stripe_session_id: string | null;
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setCourses([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('published', true)
        .order('sort_order');
      if (!cancelled) {
        setCourses((data as Course[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { courses, loading };
}

export function useCourse(slug: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setCourse(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!cancelled) {
        setCourse((data as Course) ?? null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { course, loading };
}

export async function startCourseCheckout(slug: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('stripe-checkout-course', {
    body: { course_slug: slug },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}

/** Hook for the signed-in user's own course enrollments. */
export function useMyEnrollments() {
  const user = useUser();
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setEnrollments([]);
        setLoading(false);
        return;
      }
      let query = supabase
        .from('course_enrollments')
        .select('id, course_slug, email, started_on, last_sent_day, status, stripe_session_id')
        .order('created_at', { ascending: false });
      if (user?.email) query = query.eq('email', user.email);
      const { data } = await query;
      if (!cancelled) {
        setEnrollments((data as CourseEnrollment[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { enrollments, loading };
}

/** Describe when a course starts in human-friendly prose. */
export function describeStart(course: Course): string {
  switch (course.start_trigger) {
    case 'on_purchase':
      return 'Starts the day after you purchase.';
    case 'fixed_date':
      return course.start_date
        ? `Starts on ${new Date(course.start_date).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
          })}.`
        : 'Starts on a fixed date.';
    case 'ash_wednesday':
      return 'Starts on Ash Wednesday of each year.';
    case 'first_sunday_advent':
      return 'Starts on the First Sunday of Advent.';
  }
}
