// src/ui/Array3DToolbar.jsx
import "./Array3DToolBar.css";

function getDimsByOrder(data, order = "zyx") {
  const a0 = Array.isArray(data) ? data.length : 0;
  const a1 = Array.isArray(data?.[0]) ? data[0].length : 0;
  const a2 = Array.isArray(data?.[0]?.[0]) ? data[0][0].length : 0;

  const ord = String(order || "zyx").toLowerCase();
  if (!/^[xyz]{3}$/.test(ord)) return { X: a2, Y: a1, Z: a0 };

  // order[0]축 길이=a0, order[1]=a1, order[2]=a2
  const dims = { x: 0, y: 0, z: 0 };
  dims[ord[0]] = a0;
  dims[ord[1]] = a1;
  dims[ord[2]] = a2;

  return { X: dims.x, Y: dims.y, Z: dims.z };
}

export default function ArrayToolbar({
  data,
  isSplit,
  setIsSplit,
  threshold,
  setThreshold,
  axisOrder,
  setAxisOrder,
}) {
  const { X, Y, Z } = getDimsByOrder(data, axisOrder);

  const onChangeThreshold = (e) => {
    const v = Number(e.target.value);
    setThreshold(Number.isFinite(v) ? v : 0);
  };

  return (
    <div className="toolbar array-toolbar">
      <div className="array-toolbar-left">
        <div className="array-toolbar-title">3D Array Viewer</div>
        <div className="array-toolbar-meta">
          Size: <span className="array-toolbar-dim">{X}</span> ×{" "}
          <span className="array-toolbar-dim">{Y}</span> ×{" "}
          <span className="array-toolbar-dim">{Z}</span>
        </div>
      </div>

      <div className="array-toolbar-right">
        <div className="array-toolbar-field">
          <label className="array-toolbar-label">Axis</label>
          <select
            className="array-toolbar-select"
            value={axisOrder}
            onChange={(e) => setAxisOrder(e.target.value)}
          >
            <option value="zyx">zyx (data[z][y][x])</option>
            <option value="xyz">xyz (data[x][y][z])</option>
            <option value="xzy">xzy</option>
            <option value="yxz">yxz</option>
            <option value="yzx">yzx</option>
            <option value="zxy">zxy</option>
          </select>
        </div>

        <div className="array-toolbar-field">
          <label className="array-toolbar-label">Threshold</label>
          <input
            className="array-toolbar-input"
            type="number"
            step="1"
            value={threshold}
            onChange={onChangeThreshold}
          />
        </div>

        <button
          className="btn array-toolbar-btn"
          onClick={() => setIsSplit((v) => !v)}
        >
          {isSplit ? "Merge View" : "Split View"}
        </button>
      </div>
    </div>
  );
}
