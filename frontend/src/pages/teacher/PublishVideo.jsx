import PublishVideoForm from "../../components/teacher/PublishVideoForm";
import toast from "react-hot-toast";

export default function PublishVideo() {
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Publish Video</h1>
      <p className="text-sm text-gray-500 mb-8">
        Select a video template and publish it for your students.
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <PublishVideoForm
          onPublished={() => toast.success("Video is now live!")}
        />
      </div>
    </div>
  );
}
