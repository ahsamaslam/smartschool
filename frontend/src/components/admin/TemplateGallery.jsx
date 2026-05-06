/**
 * TemplateGallery — Browse, preview, and apply design templates to topics
 *
 * Features:
 * - Beautiful grid display of available templates
 * - Live preview with theme colors
 * - Filter by category
 * - Search functionality
 * - Apply template with one click
 */

import { useState, useEffect } from "react";
import {
  SparklesIcon,
  CheckCircleIcon,
  EyeIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "../common/Button";
import toast from "react-hot-toast";

export default function TemplateGallery({ topic, onApply, adminService }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [applying, setApplying] = useState(null);

  const categories = [
    { id: "all", label: "All Templates" },
    { id: "ocean", label: "🌊 Ocean" },
    { id: "nature", label: "🌿 Nature" },
    { id: "tech", label: "⚡ Tech" },
    { id: "vibrant", label: "🎨 Vibrant" },
    { id: "minimal", label: "✨ Minimal" },
    { id: "elegant", label: "👑 Elegant" },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await adminService.getDesignTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      toast.error("Failed to load templates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (template) => {
    if (!topic?.id) {
      toast.error("Topic ID is missing");
      return;
    }

    setApplying(template.id);
    try {
      await adminService.applyTemplateToTopic(template.id, topic.id);
      toast.success(`✨ Applied "${template.name}" template!`);
      onApply?.(template);
      setPreviewTemplate(null);
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to apply template"
      );
    } finally {
      setApplying(null);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchCategory =
      selectedCategory === "all" || t.category === selectedCategory;
    const matchSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-gray-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center border border-gray-200 rounded-lg px-3 bg-white">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2 py-2 text-sm bg-transparent focus:outline-none"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <SparklesIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
          <p>No templates match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
            >
              {/* Template Preview Card */}
              <div
                style={{ background: template.theme_config?.bg }}
                className="aspect-video flex flex-col items-center justify-center text-white p-4 relative overflow-hidden"
              >
                {/* Texture overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10" />

                {/* Preview Content */}
                <div className="relative z-10 text-center space-y-2">
                  <div className="text-2xl font-bold truncate">{template.name}</div>
                  <div className="text-xs opacity-75 truncate">{template.category}</div>
                  
                  {/* Color swatches */}
                  <div className="flex gap-1 justify-center mt-3">
                    <div
                      className="w-3 h-3 rounded-full border border-white/30"
                      style={{ backgroundColor: template.theme_config?.accent }}
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-white/30"
                      style={{ backgroundColor: template.theme_config?.accentDark }}
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-white/30"
                      style={{ backgroundColor: template.theme_config?.bullet }}
                    />
                  </div>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="p-2 bg-white/20 backdrop-blur hover:bg-white/40 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <EyeIcon className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => handleApplyTemplate(template)}
                    disabled={applying === template.id}
                    className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60"
                  >
                    {applying === template.id ? "Applying..." : "Apply"}
                  </button>
                </div>
              </div>

              {/* Info Footer */}
              <div className="bg-white p-3 space-y-1">
                <h3 className="font-semibold text-sm text-gray-900 truncate">
                  {template.name}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {template.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                  <span>{template.is_system ? "📦 System" : "👤 Custom"}</span>
                  <span>{template.usage_count} uses</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onApply={() => {
            handleApplyTemplate(previewTemplate);
            setPreviewTemplate(null);
          }}
          applying={applying === previewTemplate.id}
        />
      )}
    </div>
  );
}

// ─── Preview Modal ───────────────────────────────────────────────────────────

function PreviewModal({ template, onClose, onApply, applying }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{template.name}</h2>
            <p className="text-sm text-gray-500">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-6 space-y-6">
          {/* Full Preview */}
          <div
            style={{ background: template.theme_config?.bg }}
            className="rounded-xl p-8 text-white aspect-video flex flex-col justify-between overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/20" />
            <div className="relative z-10 space-y-4">
              <div>
                <h3 className="text-3xl font-bold mb-2">Sample Heading</h3>
                <p className="text-lg opacity-90">
                  This is how your content will look with this template
                </p>
              </div>
            </div>
            <div className="relative z-10 space-y-2">
              <div className="flex gap-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: template.theme_config?.pill,
                    color: template.theme_config?.accent,
                  }}
                >
                  Key Point 1
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: template.theme_config?.pill,
                    color: template.theme_config?.accent,
                  }}
                >
                  Key Point 2
                </span>
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Color Palette</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: "Primary", color: template.theme_config?.accent },
                { name: "Secondary", color: template.theme_config?.accentDark },
                { name: "Bullet", color: template.theme_config?.bullet },
                { name: "Card", color: template.theme_config?.card },
              ].map((swatch) => (
                <div key={swatch.name} className="space-y-2">
                  <div
                    className="h-16 rounded-lg shadow-sm border border-gray-200"
                    style={{ backgroundColor: swatch.color }}
                  />
                  <p className="text-xs font-medium text-gray-700">
                    {swatch.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Category
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {template.category}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Type
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {template.is_system ? "System" : "Custom"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Usage
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {template.usage_count} topics
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Created
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(template.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onApply}
            loading={applying}
            fullWidth
          >
            <SparklesIcon className="h-4 w-4 inline mr-2" />
            Apply This Template
          </Button>
        </div>
      </div>
    </div>
  );
}
