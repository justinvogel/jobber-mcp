import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JobberClient } from "../jobber-client.js";
import {
  connectionArgs,
  getArgs,
  okJson,
  errorResult,
  runGetQuery,
  runListQuery,
  type ConnectionArgs,
} from "./helpers.js";

// ──────────────────────────────────────────────────────────────────────────────
// Default field selections per node type.
//
// These are intentionally conservative — they stick to fields that have been
// stable in the Jobber public schema. Callers who need more should either pass
// `fields:` to override the selection or drop to the raw `jobber_graphql` tool.
// ──────────────────────────────────────────────────────────────────────────────

// Default selections verified against the live Jobber schema via introspection.
// PropertyAddress uses `street1/street2`, not `street`. Assessment / Visit /
// ProductOrService do not have `updatedAt`. ProductOrService has no `createdAt`
// or `bookable` (use `bookableType`). Account has no `timezone` (that's a
// User-level field).
const FIELDS = {
  client: `
    id firstName lastName companyName isCompany isArchived email phone
    emails { id address description primary }
    phones { id number description primary }
    createdAt updatedAt
  `,
  request: `
    id title source requestStatus createdAt updatedAt
    client { id firstName lastName companyName }
    property { id address { street1 street2 city province country postalCode } }
  `,
  job: `
    id jobNumber title jobStatus jobType startAt endAt total createdAt updatedAt
    client { id firstName lastName companyName }
    property { id address { street1 street2 city province country postalCode } }
  `,
  quote: `
    id quoteNumber quoteStatus title message createdAt updatedAt
    amounts { subtotal total depositAmount discountAmount }
    client { id firstName lastName companyName }
    property { id address { street1 street2 city province country postalCode } }
  `,
  invoice: `
    id invoiceNumber invoiceStatus subject message issuedDate dueDate receivedDate createdAt updatedAt
    amounts { subtotal total depositAmount discountAmount invoiceBalance }
    client { id firstName lastName companyName }
  `,
  account: `
    id name industry countryCode phone createdAt
  `,
  assessment: `
    id title startAt endAt completedAt isComplete instructions
    client { id firstName lastName companyName }
    property { id address { street1 street2 city province country postalCode } }
  `,
  expense: `
    id title description total date
    reimbursableTo { id }
    enteredBy { id }
    linkedJob { id jobNumber }
    createdAt updatedAt
  `,
  productOrService: `
    id name description defaultUnitCost markup taxable visible durationMinutes
  `,
  timeSheetEntry: `
    id startAt endAt note ticking finalDuration label
    user { id }
    client { id }
    createdAt updatedAt
  `,
  property: `
    id isBillingAddress
    taxRate { id label }
    address { street1 street2 city province country postalCode }
    client { id firstName lastName companyName }
  `,
  user: `
    id isAccountAdmin isAccountOwner
    name { first last full }
    email { raw }
    phone { raw }
    createdAt
  `,
  visit: `
    id startAt endAt completedAt isComplete title instructions
    job { id jobNumber }
    assignedUsers(first: 25) { nodes { id name { full } } }
    createdAt
  `,
};

interface ListToolSpec {
  tool: string;
  connection: string;
  title: string;
  description: string;
  defaultFields: string;
  filterType?: string;
  sortType?: string;
  hasTotalCount?: boolean;
}

interface GetToolSpec {
  tool: string;
  queryField: string;
  title: string;
  description: string;
  defaultFields: string;
}

// Filter / sort input type names follow Jobber's naming convention of
// `<Node>FilterAttributes` and `<Node>SortInput`. Where unsure, the filter type
// is left undefined and the `filter` arg is simply ignored (callers can fall
// back to the raw `jobber_graphql` tool for custom filtering).
const lists: ListToolSpec[] = [
  { tool: "jobber_list_clients", connection: "clients", title: "List Clients", description: "List Jobber clients with cursor pagination.", defaultFields: FIELDS.client, filterType: "ClientFilterAttributes", sortType: "ClientSortInput" },
  { tool: "jobber_list_requests", connection: "requests", title: "List Requests", description: "List Jobber work requests.", defaultFields: FIELDS.request, filterType: "RequestFilterAttributes", sortType: "RequestSortInput" },
  { tool: "jobber_list_jobs", connection: "jobs", title: "List Jobs", description: "List Jobber jobs.", defaultFields: FIELDS.job, filterType: "JobFilterAttributes", sortType: "JobSortInput" },
  { tool: "jobber_list_quotes", connection: "quotes", title: "List Quotes", description: "List Jobber quotes.", defaultFields: FIELDS.quote, filterType: "QuoteFilterAttributes", sortType: "QuoteSortInput" },
  { tool: "jobber_list_invoices", connection: "invoices", title: "List Invoices", description: "List Jobber invoices.", defaultFields: FIELDS.invoice, filterType: "InvoiceFilterAttributes", sortType: "InvoiceSortInput" },
  // Jobber's schema has no top-level `assessments` connection — only the
  // singular `assessment(id:)` query and Request.assessment. So there's no
  // list tool for assessments; use jobber_get_assessment or query via
  // jobber_list_requests + the raw tool.
  { tool: "jobber_list_expenses", connection: "expenses", title: "List Expenses", description: "List Jobber expenses.", defaultFields: FIELDS.expense, filterType: "ExpenseFilterAttributes", sortType: "ExpenseSortInput" },
  { tool: "jobber_list_products_and_services", connection: "productOrServices", title: "List Products & Services", description: "List ProductOrService records in the account's price list.", defaultFields: FIELDS.productOrService, filterType: "ProductOrServiceFilterAttributes", sortType: "ProductOrServiceSortInput" },
  { tool: "jobber_list_time_sheet_entries", connection: "timeSheetEntries", title: "List Time Sheet Entries", description: "List time tracking entries.", defaultFields: FIELDS.timeSheetEntry, filterType: "TimeSheetEntryFilterAttributes", sortType: "TimeSheetEntrySortInput" },
  { tool: "jobber_list_properties", connection: "properties", title: "List Properties", description: "List service locations / properties.", defaultFields: FIELDS.property, filterType: "PropertyFilterAttributes", sortType: "PropertySortInput" },
  { tool: "jobber_list_users", connection: "users", title: "List Users", description: "List users on the Jobber account.", defaultFields: FIELDS.user },
  { tool: "jobber_list_visits", connection: "visits", title: "List Visits", description: "List scheduled visits for jobs.", defaultFields: FIELDS.visit, filterType: "VisitFilterAttributes", sortType: "VisitSortInput" },
];

const gets: GetToolSpec[] = [
  { tool: "jobber_get_client", queryField: "client", title: "Get Client", description: "Fetch a single client by ID.", defaultFields: FIELDS.client },
  { tool: "jobber_get_request", queryField: "request", title: "Get Request", description: "Fetch a single request by ID.", defaultFields: FIELDS.request },
  { tool: "jobber_get_job", queryField: "job", title: "Get Job", description: "Fetch a single job by ID.", defaultFields: FIELDS.job },
  { tool: "jobber_get_quote", queryField: "quote", title: "Get Quote", description: "Fetch a single quote by ID.", defaultFields: FIELDS.quote },
  { tool: "jobber_get_invoice", queryField: "invoice", title: "Get Invoice", description: "Fetch a single invoice by ID.", defaultFields: FIELDS.invoice },
  { tool: "jobber_get_assessment", queryField: "assessment", title: "Get Assessment", description: "Fetch a single assessment by ID.", defaultFields: FIELDS.assessment },
  { tool: "jobber_get_expense", queryField: "expense", title: "Get Expense", description: "Fetch a single expense by ID.", defaultFields: FIELDS.expense },
  { tool: "jobber_get_product_or_service", queryField: "productOrService", title: "Get Product or Service", description: "Fetch a single product/service by ID.", defaultFields: FIELDS.productOrService },
  { tool: "jobber_get_time_sheet_entry", queryField: "timeSheetEntry", title: "Get Time Sheet Entry", description: "Fetch a single time sheet entry by ID.", defaultFields: FIELDS.timeSheetEntry },
  { tool: "jobber_get_property", queryField: "property", title: "Get Property", description: "Fetch a single property by ID.", defaultFields: FIELDS.property },
  { tool: "jobber_get_user", queryField: "user", title: "Get User", description: "Fetch a single user by ID.", defaultFields: FIELDS.user },
  { tool: "jobber_get_visit", queryField: "visit", title: "Get Visit", description: "Fetch a single visit by ID.", defaultFields: FIELDS.visit },
];

export function registerQueryTools(server: McpServer, client: JobberClient): void {
  // List tools.
  for (const spec of lists) {
    server.registerTool(
      spec.tool,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: connectionArgs,
      },
      async (args: ConnectionArgs) => {
        try {
          const data = await runListQuery(client, {
            connection: spec.connection,
            defaultFields: spec.defaultFields,
            filterType: spec.filterType,
            sortType: spec.sortType,
            hasTotalCount: spec.hasTotalCount,
          }, args);
          return okJson(data);
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  // Get-by-id tools.
  for (const spec of gets) {
    server.registerTool(
      spec.tool,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: getArgs,
      },
      async (args: { id: string; fields?: string }) => {
        try {
          const data = await runGetQuery(client, {
            queryField: spec.queryField,
            defaultFields: spec.defaultFields,
          }, args);
          return okJson(data);
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  // Account is singleton (no list, no id).
  server.registerTool(
    "jobber_get_account",
    {
      title: "Get Account",
      description: "Fetch the authenticated Jobber account's profile.",
      inputSchema: {
        fields: z.string().optional().describe("Override the default selection set."),
      },
    },
    async (args: { fields?: string }) => {
      try {
        const fields = args.fields ?? FIELDS.account;
        const data = await client.request(
          `query Get_account { account { ${fields} } }`,
          {},
          { operationName: "Get_account" },
        );
        return okJson(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
