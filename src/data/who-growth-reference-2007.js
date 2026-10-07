import bfaBoys from "./growth-reference/who2007/bfa-boys.js";
import bfaGirls from "./growth-reference/who2007/bfa-girls.js";
import hfaBoys from "./growth-reference/who2007/hfa-boys.js";
import hfaGirls from "./growth-reference/who2007/hfa-girls.js";
import wfaBoys from "./growth-reference/who2007/wfa-boys.js";
import wfaGirls from "./growth-reference/who2007/wfa-girls.js";

export const WHO_GROWTH_REFERENCE_META = {
  id: "WHO_2007_5_19",
  name: "WHO Growth Reference 2007",
  organization: "World Health Organization",
  method: "LMS",
  ageMinMonths: 61,
  ageMaxMonths: 228
};

export const WHO_INDICATOR_RANGES = {
  "height-for-age": {
    minMonth: 61,
    maxMonth: 228
  },
  "BMI-for-age": {
    minMonth: 61,
    maxMonth: 228
  },
  "weight-for-age": {
    minMonth: 61,
    maxMonth: 120
  }
};

export const WHO_GROWTH_REFERENCE_DATA = {
  "height-for-age": {
    male: hfaBoys.data,
    female: hfaGirls.data
  },
  "BMI-for-age": {
    male: bfaBoys.data,
    female: bfaGirls.data
  },
  "weight-for-age": {
    male: wfaBoys.data,
    female: wfaGirls.data
  }
};
