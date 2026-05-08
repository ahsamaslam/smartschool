import { SlideRenderer } from "./SlideRenderer";

export function SlideThumbnail({
  slide,
  template,
  index,
  isSelected,
  onClick,
  onDoubleClickOpen,
  onDragStart,
  onDragOver,
  onDrop,
  draggable,
}) {
  return (
    <div
      title={onDoubleClickOpen ? "Double-click for full-slide editor" : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClickOpen?.();
      }}
      className={`relative cursor-pointer rounded-lg overflow-hidden transition-all flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isSelected ? "ring-2 ring-indigo-500 shadow-lg" : "ring-1 ring-gray-200 hover:ring-indigo-300"
      }`}
      style={{ width: "120px", height: "68px" }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      <div style={{ width: "800px", height: "450px", transformOrigin: "top left", transform: "scale(0.15)", pointerEvents: "none" }}>
        <SlideRenderer slide={slide} template={template} slideIndex={index} />
      </div>
      <div className={`absolute inset-0 flex items-end justify-start p-1 ${isSelected ? "bg-indigo-900/10" : ""}`}>
        <span className="text-[9px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded-full">{index + 1}</span>
      </div>
    </div>
  );
}
