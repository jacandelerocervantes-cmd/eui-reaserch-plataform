export type Unit = {
  id: string;
  name: string;
  unit_number: number;
  is_closed?: boolean;
  attendance_closed_at?: string | null;
  grades_closed_at?: string | null;
};
export type Activity = { id: string; unit_id: string; name: string; weight_percentage: number; };
export type Assignment = {
  id: string;
  unit_id: string;
  title: string;
  submission_type?: string;
  rubric_data?: { weight_percentage?: number; [key: string]: unknown };
  weight_percentage?: number;
};
export type Exam = {
  id: string;
  unit_id: string;
  title: string;
  weight_percentage?: number;
  weight_data?: { weight_percentage?: number; [key: string]: unknown } | null;
};
export type Student = {
  id: string;
  matricula: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  nombres: string;
};
export type GradeRow = { student_id: string; activity_id: string; score: number };
export type GradesMap = Record<string, string | number>;
export type AttendanceRow = { student_id: string; status: number };


