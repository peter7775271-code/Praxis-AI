export type YearLevel = 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';

export type PaperKeyInput = {
  year: string;
  subject: string;
  grade: string;
  school: string;
};

export const BROWSE_SUBJECTS: { label: string; value: string }[] = [
  { label: 'Maths 7-10', value: 'Mathematics' },
  { label: 'Mathematics Standard', value: 'Mathematics Standard' },
  { label: 'Mathematics Advanced', value: 'Mathematics Advanced' },
  { label: 'Mathematics Extension 1', value: 'Mathematics Extension 1' },
  { label: 'Mathematics Extension 2', value: 'Mathematics Extension 2' },
];

export const MIN_EXAM_YEAR = 2017;
export const CURRENT_EXAM_YEAR = new Date().getFullYear();
export const BROWSE_YEARS = Array.from(
  { length: CURRENT_EXAM_YEAR - MIN_EXAM_YEAR + 1 },
  (_, i) => String(CURRENT_EXAM_YEAR - i)
);
export const BROWSE_GRADES_SENIOR = ['Year 11', 'Year 12'] as const;
export const BROWSE_GRADES_JUNIOR = ['Year 7', 'Year 8', 'Year 9', 'Year 10'] as const;

export const SUBJECTS_BY_YEAR: Record<YearLevel, string[]> = {
  'Year 7': ['Mathematics'],
  'Year 8': ['Mathematics'],
  'Year 9': ['Mathematics'],
  'Year 10': ['Mathematics'],
  'Year 11': ['Mathematics Standard', 'Mathematics Advanced', 'Mathematics Extension 1'],
  'Year 12': ['Mathematics Standard', 'Mathematics Advanced', 'Mathematics Extension 1', 'Mathematics Extension 2'],
};

export const TOPICS_BY_YEAR_SUBJECT: Record<YearLevel, Record<string, string[]>> = {
  'Year 7': {
    Mathematics: [
      'Computation with integers',
      'Fractions, decimals and percentages',
      'Ratios and rates',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Length',
      "Right-angled triangles (Pythagoras' theorem)",
      'Area',
      'Volume',
      'Angle relationships',
      'Properties of geometrical figures',
      'Data classification and visualisation',
      'Data analysis',
      'Probability',
    ],
  },
  'Year 8': {
    Mathematics: [
      'Computation with integers',
      'Fractions, decimals and percentages',
      'Ratios and rates',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Length',
      "Right-angled triangles (Pythagoras' theorem)",
      'Area',
      'Volume',
      'Angle relationships',
      'Properties of geometrical figures',
      'Data classification and visualisation',
      'Data analysis',
      'Probability',
    ],
  },
  'Year 9': {
    Mathematics: [
      'Financial mathematics',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Non-linear relationships',
      'Numbers of any magnitude',
      'Trigonometry',
      'Area and surface area',
      'Volume',
      'Properties of geometrical figures',
      'Data analysis',
      'Probability',
      'Variation and rates of change',
      'Polynomials',
      'Logarithms',
      'Functions and other graphs',
      'Circle geometry',
      'Introduction to networks',
    ],
  },
  'Year 10': {
    Mathematics: [
      'Financial mathematics',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Non-linear relationships',
      'Numbers of any magnitude',
      'Trigonometry',
      'Area and surface area',
      'Volume',
      'Properties of geometrical figures',
      'Data analysis',
      'Probability',
      'Variation and rates of change',
      'Polynomials',
      'Logarithms',
      'Functions and other graphs',
      'Circle geometry',
      'Introduction to networks',
    ],
  },
  'Year 12': {
    'Mathematics Standard': [
      'Algebraic relationships',
      'Investment and loans',
      'Annuities',
      'Trigonometry',
      'Ratios and rates',
      'Network flow',
      'Critical path analysis',
      'Bivariate data analysis',
      'Relative frequency and probability',
      'The normal distribution',
    ],
    'Mathematics Advanced': [
      'Further graph transformations and modelling',
      'Sequences and series',
      'Differential calculus',
      'Integral calculus',
      'Applications of calculus',
      'Random variables',
      'Financial mathematics',
    ],
    'Mathematics Extension 1': [
      'Proof by mathematical induction',
      'Vectors',
      'Inverse trigonometric functions',
      'Further calculus skills',
      'Further applications of calculus',
      'The binomial distribution and sampling distribution of the mean',
    ],
    'Mathematics Extension 2': [
      'The nature of proof',
      'Further work with vectors',
      'Introduction to complex numbers',
      'Further integration',
      'Applications of calculus to mechanics',
    ],
  },
  'Year 11': {
    'Mathematics Standard': [
      'Algebraic relationships',
      'Investment and loans',
      'Annuities',
      'Trigonometry',
      'Ratios and rates',
      'Network flow',
      'Critical path analysis',
      'Bivariate data analysis',
      'Relative frequency and probability',
      'The normal distribution',
    ],
    'Mathematics Advanced': [
      'Working with functions',
      'Trigonometry and measure of angles',
      'Trigonometric identities and equations',
      'Differentiation',
      'Exponential and logarithmic functions',
      'Graph transformations',
      'Probability and data',
    ],
    'Mathematics Extension 1': [
      'Further work with functions',
      'Polynomials',
      'Further trigonometry',
      'Permutations and combinations',
      'The binomial theorem',
    ],
  },
};

export const getTopics = (gradeValue: string, subjectValue: string) => {
  const gradeKey = gradeValue as keyof typeof TOPICS_BY_YEAR_SUBJECT;
  return TOPICS_BY_YEAR_SUBJECT[gradeKey]?.[subjectValue] || [];
};

export const getPaperKey = (paper: PaperKeyInput) =>
  `${paper.year}__${paper.grade}__${paper.subject}__${paper.school}`;
