import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function TeacherReports() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/manager/reports", { replace: true });
  }, [navigate]);
  return null;
}
