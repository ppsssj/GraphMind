// src/data/dummyEquations.js

// 2D 수식 더미
export const dummyEquations = [
  {
    id: "eq1",
    type: "equation",
    title: "Quadratic Curve",
    formula: "y = x^2 + 3x - 4",
    tags: ["polynomial", "quadratic"],
    links: ["eq3"],
    updatedAt: "2025-08-30T12:00:00Z",
  },
  {
    id: "eq2",
    type: "equation",
    title: "Sine Wave",
    formula: "y = sin(x)",
    tags: ["trig", "periodic"],
    links: [],
    updatedAt: "2025-08-31T09:20:00Z",
  },
  {
    id: "eq3",
    type: "equation",
    title: "Cubic",
    formula: "y = 0.5x^3 - 2x",
    tags: ["polynomial", "cubic"],
    links: ["eq1"],
    updatedAt: "2025-09-01T18:45:00Z",
  },
  {
    id: "eq4",
    type: "equation",
    title: "Exponential",
    formula: "y = e^{0.3x}",
    tags: ["exp", "growth"],
    links: [],
    updatedAt: "2025-09-02T15:10:00Z",
  },
  {
    id: "eq5",
    type: "equation",
    title: "Gaussian",
    formula: "y = exp(-x^2)",
    tags: ["gaussian", "probability"],
    links: [],
    updatedAt: "2025-09-03T03:12:00Z",
  },
];

// 3D 배열 더미
export const dummyArrays3D = [
  {
    id: "arr1",
    type: "array3d",
    title: "Voxel Grid — Small Cross",
    content: [
      // z = 0
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
      // z = 1
      [
        [0, 1, 0, 0],
        [1, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      // z = 2
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
      // z = 3
      [
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
    tags: ["voxel", "demo"],
    links: [],
    updatedAt: "2025-09-03T10:00:00Z",
  },
  {
    id: "arr2",
    type: "array3d",
    title: "Sparse Dots",
    content: [
      // z = 0
      [
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
        [0, 0, 0, 0],
      ],
      // z = 1
      [
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 1],
      ],
      // z = 2
      [
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      // z = 3
      [
        [0, 0, 0, 1],
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
    tags: ["voxel", "sparse"],
    links: [],
    updatedAt: "2025-09-04T08:40:00Z",
  },
];

// 3D 곡선 더미
export const dummyCurves3D = [
  {
    id: "c3d1",
    type: "curve3d",
    title: "3D Helix",
    x: "x(t) = cos(t)",
    y: "y(t) = sin(t)",
    z: "z(t) = 0.2 * t",
    tRange: [0, 6 * Math.PI],
    samples: 600,
    tags: ["3d", "curve", "helix"],
    links: [],
    updatedAt: "2025-09-05T10:00:00Z",
  },
  {
    id: "c3d2",
    type: "curve3d",
    title: "Lissajous Knot",
    x: "x(t) = sin(3 * t)",
    y: "y(t) = sin(4 * t + pi/2)",
    z: "z(t) = sin(5 * t)",
    tRange: [0, 2 * Math.PI],
    samples: 800,
    tags: ["3d", "curve", "lissajous"],
    links: [],
    updatedAt: "2025-09-05T10:05:00Z",
  },
  {
    id: "c3d3",
    type: "curve3d",
    title: "Wavy Ribbon",
    x: "x(t) = t",
    y: "y(t) = sin(t)",
    z: "z(t) = 0.5 * cos(2 * t)",
    tRange: [-4 * Math.PI, 4 * Math.PI],
    samples: 700,
    tags: ["3d", "curve", "wave"],
    links: [],
    updatedAt: "2025-09-05T10:10:00Z",
  },
];

// ✅ 3D 곡면(z = f(x,y)) 더미
export const dummySurfaces3D = [
  {
    id: "s3d1",
    type: "surface3d",
    title: "Saddle Surface",
    // Vault / LeftPanel / Studio 모두 expr 또는 formula를 봄
    expr: "x^2 - y^2",
    xRange: [-3, 3],
    yRange: [-3, 3],
    samples: 80,
    tags: ["3d", "surface", "saddle"],
    links: ["eq1"],
    updatedAt: "2025-09-06T09:00:00Z",
  },
  {
    id: "s3d2",
    type: "surface3d",
    title: "Gaussian Hill",
    expr: "exp(-(x^2 + y^2))",
    xRange: [-4, 4],
    yRange: [-4, 4],
    samples: 96,
    tags: ["3d", "surface", "gaussian"],
    links: ["eq5"],
    updatedAt: "2025-09-06T09:10:00Z",
  },
  {
    id: "s3d3",
    type: "surface3d",
    title: "Ripple Surface",
    expr: "sin(sqrt(x^2 + y^2)) / (1 + 0.3 * (x^2 + y^2))",
    xRange: [-6, 6],
    yRange: [-6, 6],
    samples: 100,
    tags: ["3d", "surface", "wave"],
    links: ["eq2"],
    updatedAt: "2025-09-06T09:20:00Z",
  },
];

// Vault에서 한 번에 쓰기 위한 통합 리소스
export const dummyResources = [
  ...dummyEquations,
  ...dummyArrays3D,
  ...dummyCurves3D,
  ...dummySurfaces3D,
];
