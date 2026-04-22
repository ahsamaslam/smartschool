import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import studentService from "../../services/studentService";
import TopicList from "../../components/student/TopicList";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

export default function SubjectView() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectName, setSubjectName] = useState("");

  useEffect(() => {
    if (!user?.id || !subjectId) return;
    studentService
      .getSubjectTopics(subjectId, user.id)
      .then((res) => {
        const data = res.data || [];
        setTopics(data);
        if (data.length > 0) setSubjectName(data[0]?.subject_name || "Subject");
      })
      .catch(() => setError("Failed to load topics."))
      .finally(() => setLoading(false));
  }, [subjectId, user?.id]);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {subjectName || "Subject"}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Select a topic to start learning.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <TopicList topics={topics} />
    </div>
  );
}
