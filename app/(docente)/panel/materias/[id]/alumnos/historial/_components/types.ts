export type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };
export type AttendanceRecord = { student_id: string; session_date: string; session_number: number; unit_number: number; status: number; justification_text?: string; file_url?: string; };
export type CourseUnit = { id: string; unit_number: number; title: string; is_closed: boolean; };
export type SelectedRecord = {
  student_id: string;
  student_name: string;
  session_date: string;
  session_number: number;
  new_status: number;
  justification: string;
  file_url: string | null;
  exists: boolean;
};
