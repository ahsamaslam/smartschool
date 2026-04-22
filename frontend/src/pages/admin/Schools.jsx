import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminService from "../../services/adminService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import {
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export default function AdminSchools() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ name: "", address: "" });
  const [branchForm, setBranchForm] = useState({
    school_id: "",
    name: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => {
    adminService
      .getSchools()
      .then((res) => setSchools(res.data || []))
      .catch(() => setError("Failed to load schools."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.createSchool(schoolForm);
      toast.success("School created!");
      setShowSchoolModal(false);
      setSchoolForm({ name: "", address: "" });
      load();
    } catch {
      toast.error("Failed to create school.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.createBranch(branchForm);
      toast.success("Branch created!");
      setShowBranchModal(false);
      setBranchForm({ school_id: "", name: "", address: "" });
    } catch {
      toast.error("Failed to create branch.");
    } finally {
      setSaving(false);
    }
  };

  const schoolOptions = schools.map((s) => ({ value: s.id, label: s.name }));
  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.address || "").toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schools & Branches</h1>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowBranchModal(true)}>
            + Branch
          </Button>
          <Button variant="primary" onClick={() => setShowSchoolModal(true)}>
            + School
          </Button>
        </div>
      </div>
      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search schools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          {schools.length === 0
            ? "No schools yet."
            : "No schools match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-gray-200 p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {s.name}
                  </h3>
                  {s.address && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {s.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-6 text-xs text-gray-500 mb-4">
                <span>{s.branch_count ?? 0} branches</span>
                <span>{s.class_count ?? 0} classes</span>
              </div>
              <Link
                to={`/admin/schools/${s.id}`}
                state={{ schoolName: s.name }}
                className="block w-full text-center text-sm font-medium text-blue-600 border border-blue-200 rounded-xl py-2 hover:bg-blue-50 transition-colors"
              >
                View Branches
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showSchoolModal}
        onClose={() => setShowSchoolModal(false)}
        title="Create School"
      >
        <form onSubmit={handleCreateSchool} className="space-y-4">
          <Input
            label="School Name"
            value={schoolForm.name}
            onChange={(e) =>
              setSchoolForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <Input
            label="Address"
            value={schoolForm.address}
            onChange={(e) =>
              setSchoolForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Create School
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title="Create Branch"
      >
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <Dropdown
              options={schoolOptions}
              value={branchForm.school_id}
              onChange={(v) => setBranchForm((f) => ({ ...f, school_id: v }))}
              placeholder="Select school…"
            />
          </div>
          <Input
            label="Branch Name"
            value={branchForm.name}
            onChange={(e) =>
              setBranchForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <Input
            label="Address"
            value={branchForm.address}
            onChange={(e) =>
              setBranchForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Create Branch
          </Button>
        </form>
      </Modal>
    </div>
  );
}
