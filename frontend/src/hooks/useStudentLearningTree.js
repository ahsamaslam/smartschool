import { useCallback, useEffect, useState } from "react";
import learningService from "../services/learningService";

export default function useStudentLearningTree() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    learningService
      .getLearningTree()
      .then((res) => setData(res.data))
      .catch(() => {
        setError("Could not load your courses.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    enrollments: data?.enrollments || [],
    loading,
    error,
    reload: load,
  };
}
