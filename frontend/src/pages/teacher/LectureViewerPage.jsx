import LectureViewer from "../../components/teacher/LectureViewer";

export default function LectureViewerPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Lecture Preview</h1>
      <p className="text-sm text-gray-500 mb-8">
        Preview video lectures before publishing them to students.
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <LectureViewer />
      </div>
    </div>
  );
}
