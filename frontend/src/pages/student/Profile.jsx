import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import studentService from "../../services/studentService";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import toast from "react-hot-toast";
import { CameraIcon } from "@heroicons/react/24/outline";

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "" });
  const [picturePreview, setPicturePreview] = useState(null); // base64 data URL
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    studentService
      .getProfile(user.id)
      .then((res) => {
        const data = res.data || {};
        setProfileForm({
          full_name: data.full_name || user.full_name || "",
          email: data.email || user.email || "",
        });
        if (data.profile_picture_url) {
          setPicturePreview(data.profile_picture_url);
        }
      })
      .catch(() => {
        // fallback to auth context values
        setProfileForm({
          full_name: user.full_name || "",
          email: user.email || "",
        });
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  // ── Profile picture ──────────────────────────────────────────────
  const handlePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPicturePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── Save profile info + picture ──────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = { full_name: profileForm.full_name };
      if (picturePreview) payload.profile_picture_url = picturePreview;
      await studentService.updateProfile(user.id, payload);
      updateUser({
        full_name: profileForm.full_name,
        profile_picture_url: picturePreview,
      });
      toast.success("Profile updated!");
    } catch {
      toast.error("Update failed. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password ──────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      await studentService.changePassword(
        user.id,
        passwordForm.old_password,
        passwordForm.new_password,
      );
      toast.success("Password changed successfully!");
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to change password.";
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <PageSpinner />;

  const initials = (profileForm.full_name || user?.full_name || "S")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* ── Profile Info Card ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Profile Information
        </h2>

        {/* Avatar upload */}
        <div className="flex items-center gap-5 mb-6">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {picturePreview ? (
              <img
                src={picturePreview}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-blue-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center select-none ring-2 ring-blue-200">
                {initials}
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <CameraIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {profileForm.full_name}
            </p>
            <p className="text-sm text-blue-600 capitalize mb-2">
              {user?.role}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              Change picture
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG or PNG, max 2 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePictureChange}
          />
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={profileForm.full_name}
            onChange={(e) =>
              setProfileForm((f) => ({ ...f, full_name: e.target.value }))
            }
            required
          />
          <Input
            label="Email"
            type="email"
            value={profileForm.email}
            disabled
            hint="Email cannot be changed. Contact your administrator."
          />
          <Button type="submit" variant="primary" loading={savingProfile}>
            Save Profile
          </Button>
        </form>
      </div>

      {/* ── Change Password Card ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Change Password
        </h2>

        {passwordError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={passwordForm.old_password}
            onChange={(e) =>
              setPasswordForm((f) => ({ ...f, old_password: e.target.value }))
            }
            required
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            value={passwordForm.new_password}
            onChange={(e) =>
              setPasswordForm((f) => ({ ...f, new_password: e.target.value }))
            }
            required
            autoComplete="new-password"
            hint="Minimum 8 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={passwordForm.confirm_password}
            onChange={(e) =>
              setPasswordForm((f) => ({
                ...f,
                confirm_password: e.target.value,
              }))
            }
            required
            autoComplete="new-password"
          />
          <Button type="submit" variant="primary" loading={savingPassword}>
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
