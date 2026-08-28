"use client";

import { BookOpen } from "lucide-react";

export const EmptyQuestionsState = ({ message }: { message: string }) => (
  <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
    <BookOpen size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
    <p style={{ fontWeight: "600" }}>{message}</p>
  </div>
);
