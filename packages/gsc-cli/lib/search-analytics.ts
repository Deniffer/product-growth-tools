/**
 * @input CLI report input and raw Search Console rows
 * @output normalized query request for Search Console reads
 * @pos shared search analytics parsing and normalization helpers
 */

import type { searchconsole_v1 } from "googleapis";
import {
  validateCountryFilter,
  validateDateRange,
  validateDimensions,
  validateFilterOperator,
  validateRowLimit,
  validateSiteUrl,
  validateStartRow,
} from "./input-validation";

const SEARCH_TYPES = [
  "web",
  "image",
  "video",
  "news",
  "discover",
  "googleNews",
] as const;

const AGGREGATION_TYPES = [
  "auto",
  "byPage",
  "byProperty",
  "byNewsShowcasePanel",
] as const;

const FILTER_OPERATORS = [
  "equals",
  "contains",
  "notEquals",
  "notContains",
  "includingRegex",
  "excludingRegex",
] as const;
const REGEX_PREFIX_RE = /^regex:/;

type SearchType = (typeof SEARCH_TYPES)[number];
type AggregationType = (typeof AGGREGATION_TYPES)[number];
type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type AnalyticsInput = {
  siteUrl?: string;
  startDate: string;
  endDate: string;
  dimensions?: string;
  type?: SearchType;
  aggregationType?: AggregationType;
  dataState?: "all" | "final";
  rowLimit?: number;
  startRow?: number;
  queryFilter?: string;
  pageFilter?: string;
  countryFilter?: string;
  deviceFilter?: "DESKTOP" | "MOBILE" | "TABLET";
  filterOperator?: FilterOperator;
};

function buildFilter(
  dimension: string,
  expression: string,
  operator: FilterOperator
) {
  return {
    dimension,
    expression,
    operator,
  };
}

function buildFilters(input: AnalyticsInput) {
  const filters: searchconsole_v1.Schema$ApiDimensionFilter[] = [];
  const operator = validateFilterOperator(input.filterOperator, [
    input.queryFilter,
    input.pageFilter,
  ]) as FilterOperator;

  if (input.queryFilter) {
    filters.push(
      buildFilter(
        "query",
        input.queryFilter.replace(REGEX_PREFIX_RE, ""),
        operator
      )
    );
  }
  if (input.pageFilter) {
    filters.push(
      buildFilter(
        "page",
        input.pageFilter.replace(REGEX_PREFIX_RE, ""),
        operator
      )
    );
  }
  const countryFilter = validateCountryFilter(input.countryFilter);
  if (countryFilter) {
    filters.push(buildFilter("country", countryFilter, operator));
  }
  if (input.deviceFilter) {
    filters.push(buildFilter("device", input.deviceFilter, "equals"));
  }

  if (filters.length === 0) {
    return;
  }

  return [
    {
      groupType: "and",
      filters,
    } satisfies searchconsole_v1.Schema$ApiDimensionFilterGroup,
  ];
}

export function buildAnalyticsRequest(input: AnalyticsInput) {
  const siteUrl = validateSiteUrl(input.siteUrl);
  const dimensions = validateDimensions(input.dimensions);
  const { startDate, endDate } = validateDateRange(
    input.startDate,
    input.endDate
  );
  const rowLimit = validateRowLimit(input.rowLimit) ?? 250;
  const startRow = validateStartRow(input.startRow);

  return {
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      type: input.type,
      aggregationType: input.aggregationType,
      dataState: input.dataState,
      rowLimit,
      startRow,
      dimensionFilterGroups: buildFilters(input),
    },
    dimensions,
  };
}
