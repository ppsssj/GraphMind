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

export const dummyArrays3D = [
  {
    id: "arr1",
    type: "array3d",
    title: "Voxel Grid — Small Cross",
    content: [
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [1, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
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
      [
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 1],
      ],
      [
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
      ],
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

export const dummyResources = [...dummyEquations, ...dummyArrays3D];