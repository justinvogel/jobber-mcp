import type { MutationDescriptor } from "./mutation-registry.js";

// Selection presets for common entity payloads. Kept narrow; callers who
// want richer fields should use jobber_graphql with a custom selection.
const CLIENT_PAYLOAD = `client { id firstName lastName companyName isCompany isArchived }`;
const REQUEST_PAYLOAD = `request { id title requestStatus source createdAt }`;
const JOB_PAYLOAD = `job { id jobNumber title jobStatus startAt endAt total }`;
const QUOTE_PAYLOAD = `quote { id quoteNumber quoteStatus title createdAt }`;
const INVOICE_PAYLOAD = `invoice { id invoiceNumber invoiceStatus issuedDate dueDate amounts { total invoiceBalance } }`;
const VISIT_PAYLOAD = `visit { id title startAt endAt isComplete completedAt }`;
const ASSESSMENT_PAYLOAD = `assessment { id title startAt endAt isComplete completedAt }`;
const PROPERTY_PAYLOAD = `property { id address { street1 street2 city province country postalCode } }`;
const EXPENSE_PAYLOAD = `expense { id title description total date }`;
const PRODUCT_PAYLOAD = `productOrService { id name description defaultUnitCost markup taxable visible }`;
const TASK_PAYLOAD = `tasks { id }`;
const USER_PAYLOAD = `user { id name { full } email { raw } }`;
const NOTE_PAYLOAD = `note { id message createdAt }`;
const WEBHOOK_PAYLOAD = `webhookEndpoint { id url }`;

const PAYLOAD_NONE = ""; // mutation has no entity payload (returns just userErrors / empty)

export const MUTATION_DEFS: MutationDescriptor[] = [
  // ─── Clients ────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_client",
    title: "Create Client",
    description: "Create a new client. `input` matches Jobber's ClientCreateInput.",
    mutation: "clientCreate",
    args: [{ name: "input", type: "ClientCreateInput!", description: "Client attributes (firstName, lastName, companyName, emails, phones, billingAddress, etc.)" }],
    payload: CLIENT_PAYLOAD,
  },
  {
    tool: "jobber_create_clients",
    title: "Create Multiple Clients",
    description: "Bulk-create clients. `input` is BulkClientsCreateInput (typically `{ clients: [...] }`).",
    mutation: "clientsCreate",
    args: [{ name: "input", type: "BulkClientsCreateInput!", description: "Bulk-create payload — see Jobber docs for shape" }],
    payload: `clients { id firstName lastName companyName }`,
  },
  {
    tool: "jobber_update_client",
    title: "Update Client",
    description: "Update an existing client. `input` matches ClientEditInput. Include only fields you want to change.",
    mutation: "clientEdit",
    args: [
      { name: "clientId", type: "EncodedId!", description: "Jobber client ID" },
      { name: "input", type: "ClientEditInput!", description: "Fields to change (firstName, lastName, companyName, billingAddress, phonesToAdd/Edit/Delete, emailsToAdd/Edit/Delete, tagsToAdd/Delete, contactsToAdd/Edit/Delete, propertiesToAdd/Edit/Delete, customFields, receivesReminders/FollowUps/etc.)" },
    ],
    payload: CLIENT_PAYLOAD,
  },
  {
    tool: "jobber_archive_client",
    title: "Archive Client",
    description: "Soft-delete a client. Preserves history; reversible via jobber_unarchive_client.",
    mutation: "clientArchive",
    args: [{ name: "clientId", type: "EncodedId!", description: "Jobber client ID" }],
    payload: CLIENT_PAYLOAD,
  },
  {
    tool: "jobber_unarchive_client",
    title: "Unarchive Client",
    description: "Restore a previously-archived client.",
    mutation: "clientUnarchive",
    args: [{ name: "clientId", type: "EncodedId!", description: "Jobber client ID" }],
    payload: CLIENT_PAYLOAD,
  },
  {
    tool: "jobber_create_client_note",
    title: "Add Client Note",
    description: "Add a note on a client.",
    mutation: "clientCreateNote",
    args: [
      { name: "clientId", type: "EncodedId!" },
      { name: "input", type: "ClientCreateNoteInput!", description: "{ message: String! } and optional pinned/etc." },
    ],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_client_note",
    title: "Edit Client Note",
    description: "Edit an existing note on a client.",
    mutation: "clientEditNote",
    args: [{ name: "input", type: "ClientEditNoteInput!", description: "{ noteId: EncodedId!, message: String!, ... }" }],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_delete_client_note",
    title: "Delete Client Note",
    description: "Delete a note on a client.",
    mutation: "clientDeleteNote",
    args: [{ name: "input", type: "ClientDeleteNoteInput!", description: "{ noteId: EncodedId! }" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_add_client_note_attachment",
    title: "Attach File to Client Note",
    description: "Attach a file (signed blob) to an existing client note.",
    mutation: "clientNoteAddAttachment",
    args: [
      { name: "clientId", type: "EncodedId!" },
      { name: "noteId", type: "EncodedId!" },
      { name: "noteAddAttachmentAttributes", type: "[NoteAddAttachmentAttributes!]!", description: "Array of { signedBlobId } entries" },
    ],
    payload: NOTE_PAYLOAD,
  },

  // ─── Requests ───────────────────────────────────────────────────────────
  {
    tool: "jobber_create_request",
    title: "Create Request",
    description: "Create a new work request.",
    mutation: "requestCreate",
    args: [{ name: "input", type: "RequestCreateInput!", description: "{ clientId, title, source, propertyId, customFields, ... }" }],
    payload: REQUEST_PAYLOAD,
  },
  {
    tool: "jobber_update_request",
    title: "Update Request",
    description: "Edit a request.",
    mutation: "requestEdit",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "input", type: "RequestEditInput!" },
    ],
    payload: REQUEST_PAYLOAD,
  },
  {
    tool: "jobber_archive_request",
    title: "Archive Request",
    description: "Archive a request.",
    mutation: "requestArchive",
    args: [{ name: "requestId", type: "EncodedId!" }],
    payload: REQUEST_PAYLOAD,
  },
  {
    tool: "jobber_unarchive_request",
    title: "Unarchive Request",
    description: "Unarchive a request.",
    mutation: "requestUnarchive",
    args: [{ name: "requestId", type: "EncodedId!" }],
    payload: REQUEST_PAYLOAD,
  },
  {
    tool: "jobber_create_request_line_items",
    title: "Add Line Items to Request",
    description: "Append line items to a request.",
    mutation: "requestCreateLineItems",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "lineItems", type: "[RequestLineItemAttributes!]!", description: "Array of { name, description, quantity, unitCost, ... }" },
    ],
    payload: `request { id lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_edit_request_line_items",
    title: "Edit Request Line Items",
    description: "Edit line items on a request.",
    mutation: "requestEditLineItems",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "lineItems", type: "[RequestLineItemEditAttributes!]!", description: "Array of { id, ...edits }" },
    ],
    payload: `request { id lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_delete_request_line_items",
    title: "Delete Request Line Items",
    description: "Remove line items from a request.",
    mutation: "requestDeleteLineItems",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "lineItemIds", type: "[EncodedId!]!" },
    ],
    payload: `request { id lineItems(first: 50) { nodes { id name } } }`,
  },
  {
    tool: "jobber_create_request_note",
    title: "Add Request Note",
    description: "Add a note to a request.",
    mutation: "requestCreateNote",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "input", type: "RequestCreateNoteInput!" },
    ],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_request_note",
    title: "Edit Request Note",
    description: "Edit an existing request note.",
    mutation: "requestEditNote",
    args: [{ name: "input", type: "RequestEditNoteInput!" }],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_request_job_forms",
    title: "Attach/Detach Forms on Request",
    description: "Attach or detach form templates on a request.",
    mutation: "requestEditJobForms",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "input", type: "FormAttachmentInput", description: "{ jobFormsToAttach: [EncodedId!], jobFormsToDetach: [EncodedId!] }" },
    ],
    payload: `request { id }`,
  },

  // ─── Jobs ───────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_job",
    title: "Create Job",
    description: "Create a new job. `input` is JobCreateAttributes — { clientId, propertyId, title, jobType, startAt, endAt, lineItems, ... }.",
    mutation: "jobCreate",
    args: [{ name: "input", type: "JobCreateAttributes!" }],
    payload: JOB_PAYLOAD,
  },
  {
    tool: "jobber_update_job",
    title: "Update Job",
    description: "Edit an existing job.",
    mutation: "jobEdit",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobEditInput!" },
    ],
    payload: JOB_PAYLOAD,
  },
  {
    tool: "jobber_close_job",
    title: "Close Job",
    description: "Close a job (mark complete).",
    mutation: "jobClose",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobCloseInput!", description: "{ closeAllVisits: Boolean, ... }" },
    ],
    payload: JOB_PAYLOAD,
  },
  {
    tool: "jobber_reopen_job",
    title: "Reopen Job",
    description: "Reopen a previously-closed job.",
    mutation: "jobReopen",
    args: [{ name: "jobId", type: "EncodedId!" }],
    payload: JOB_PAYLOAD,
  },
  {
    tool: "jobber_create_job_line_items",
    title: "Add Line Items to Job",
    description: "Append line items to a job.",
    mutation: "jobCreateLineItems",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobCreateLineItemsInput!", description: "{ lineItems: [...] }" },
    ],
    payload: `job { id total lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_edit_job_line_items",
    title: "Edit Job Line Items",
    description: "Edit line items on a job.",
    mutation: "jobEditLineItems",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobEditLineItemsInput!" },
    ],
    payload: `job { id total lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_delete_job_line_items",
    title: "Delete Job Line Items",
    description: "Remove line items from a job.",
    mutation: "jobDeleteLineItems",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobDeleteLineItemsInput!", description: "{ lineItemIds: [EncodedId!]! }" },
    ],
    payload: `job { id total }`,
  },
  {
    tool: "jobber_order_job_line_items",
    title: "Reorder Job Line Items",
    description: "Set the display order of line items on a job.",
    mutation: "jobOrderLineItems",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "orderedLineItemIds", type: "[EncodedId!]!" },
    ],
    payload: `job { id }`,
  },
  {
    tool: "jobber_create_job_note",
    title: "Add Job Note",
    description: "Add a note to a job.",
    mutation: "jobCreateNote",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "JobCreateNoteInput!" },
    ],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_job_note",
    title: "Edit Job Note",
    description: "Edit an existing job note.",
    mutation: "jobEditNote",
    args: [{ name: "input", type: "JobEditNoteInput!" }],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_delete_job_note",
    title: "Delete Job Note",
    description: "Delete a job note.",
    mutation: "jobDeleteNote",
    args: [{ name: "input", type: "JobDeleteNoteInput!" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_add_job_note_attachment",
    title: "Attach File to Job Note",
    description: "Attach a file (signed blob) to an existing job note.",
    mutation: "jobNoteAddAttachment",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "noteId", type: "EncodedId!" },
      { name: "noteAddAttachmentAttributes", type: "[NoteAddAttachmentAttributes!]!" },
    ],
    payload: NOTE_PAYLOAD,
  },

  // ─── Quotes ─────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_quote",
    title: "Create Quote",
    description: "Create a new quote.",
    mutation: "quoteCreate",
    args: [{ name: "attributes", type: "QuoteCreateAttributes!", description: "{ clientId, propertyId, title, lineItems, message, ... }" }],
    payload: QUOTE_PAYLOAD,
  },
  {
    tool: "jobber_update_quote",
    title: "Update Quote",
    description: "Edit a quote.",
    mutation: "quoteEdit",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "attributes", type: "QuoteEditAttributes!" },
    ],
    payload: QUOTE_PAYLOAD,
  },
  {
    tool: "jobber_create_quote_line_items",
    title: "Add Line Items to Quote",
    description: "Append line items to a quote.",
    mutation: "quoteCreateLineItems",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "lineItems", type: "[QuoteLineItemAttributes!]!" },
    ],
    payload: `quote { id lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_create_quote_text_line_items",
    title: "Add Text-Only Line Items to Quote",
    description: "Append text-only (non-priced) line items to a quote.",
    mutation: "quoteCreateTextLineItems",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "lineItems", type: "[QuoteTextLineItemAttributes!]!" },
    ],
    payload: `quote { id }`,
  },
  {
    tool: "jobber_edit_quote_line_items",
    title: "Edit Quote Line Items",
    description: "Edit line items on a quote.",
    mutation: "quoteEditLineItems",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "lineItems", type: "[QuoteLineItemEditAttributes!]!" },
    ],
    payload: `quote { id lineItems(first: 50) { nodes { id name quantity unitCost } } }`,
  },
  {
    tool: "jobber_delete_quote_line_items",
    title: "Delete Quote Line Items",
    description: "Remove line items from a quote.",
    mutation: "quoteDeleteLineItems",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "lineItemIds", type: "[EncodedId!]!" },
    ],
    payload: `quote { id }`,
  },
  {
    tool: "jobber_create_quote_note",
    title: "Add Quote Note",
    description: "Add a note to a quote.",
    mutation: "quoteCreateNote",
    args: [
      { name: "quoteId", type: "EncodedId!" },
      { name: "input", type: "QuoteCreateNoteInput!" },
    ],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_quote_note",
    title: "Edit Quote Note",
    description: "Edit a quote note.",
    mutation: "quoteEditNote",
    args: [{ name: "input", type: "QuoteEditNoteInput!" }],
    payload: NOTE_PAYLOAD,
  },

  // ─── Invoices ───────────────────────────────────────────────────────────
  {
    tool: "jobber_create_invoice",
    title: "Create Invoice",
    description: "Create a new invoice.",
    mutation: "invoiceCreate",
    args: [{ name: "input", type: "InvoiceCreateInput!", description: "{ clientId, lineItems, issuedDate, dueDate, ... }" }],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_update_invoice",
    title: "Update Invoice",
    description: "Edit an invoice.",
    mutation: "invoiceEdit",
    args: [
      { name: "invoiceId", type: "EncodedId!" },
      { name: "input", type: "InvoiceEditInput!" },
    ],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_close_invoice",
    title: "Close Invoice",
    description: "Close an invoice (mark fully resolved). Useful for write-offs.",
    mutation: "invoiceClose",
    args: [
      { name: "id", type: "EncodedId!" },
      { name: "input", type: "InvoiceCloseInput!", description: "{ markAsBadDebt: Boolean, ... }" },
    ],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_reopen_invoice",
    title: "Reopen Paid Invoice",
    description: "Reopen a paid invoice.",
    mutation: "invoiceReopen",
    args: [{ name: "id", type: "EncodedId!" }],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_mark_invoice_sent",
    title: "Mark Invoice Sent",
    description: "Move a draft invoice to sent status.",
    mutation: "invoiceMarkAsSent",
    args: [{ name: "id", type: "EncodedId!" }],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_unmark_invoice_bad_debt",
    title: "Unmark Invoice as Bad Debt",
    description: "Clear an invoice's bad-debt flag.",
    mutation: "invoiceUnmarkBadDebt",
    args: [{ name: "id", type: "EncodedId!" }],
    payload: INVOICE_PAYLOAD,
  },
  {
    tool: "jobber_create_invoice_note",
    title: "Add Invoice Note",
    description: "Add a note to an invoice.",
    mutation: "invoiceCreateNote",
    args: [
      { name: "invoiceId", type: "EncodedId!" },
      { name: "input", type: "InvoiceCreateNoteInput!" },
    ],
    payload: NOTE_PAYLOAD,
  },
  {
    tool: "jobber_edit_invoice_note",
    title: "Edit Invoice Note",
    description: "Edit an invoice note.",
    mutation: "invoiceEditNote",
    args: [{ name: "input", type: "InvoiceEditNoteInput!" }],
    payload: NOTE_PAYLOAD,
  },

  // ─── Visits ─────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_visit",
    title: "Create Visit",
    description: "Add a visit to a job.",
    mutation: "visitCreate",
    args: [
      { name: "jobId", type: "EncodedId!" },
      { name: "input", type: "VisitCreateInput!", description: "{ startAt, endAt, title, instructions, assignedUserIds, lineItems, ... }" },
    ],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_update_visit",
    title: "Update Visit",
    description: "Edit a visit's details.",
    mutation: "visitEdit",
    args: [
      { name: "id", type: "EncodedId!" },
      { name: "attributes", type: "VisitEditAttributes!" },
    ],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_edit_visit_schedule",
    title: "Edit Visit Schedule",
    description: "Change a visit's start/end time only.",
    mutation: "visitEditSchedule",
    args: [
      { name: "id", type: "EncodedId!" },
      { name: "input", type: "VisitEditScheduleInput!", description: "{ startAt, endAt }" },
    ],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_edit_visit_assigned_users",
    title: "Edit Visit Assigned Users",
    description: "Change which team members are assigned to a visit.",
    mutation: "visitEditAssignedUsers",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "VisitEditAssignedUsersInput!", description: "{ usersToAdd: [EncodedId!], usersToRemove: [EncodedId!] }" },
    ],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_complete_visit",
    title: "Complete Visit",
    description: "Mark a visit as complete.",
    mutation: "visitComplete",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "VisitCompleteInput", description: "Optional { completedAt, ... }" },
    ],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_uncomplete_visit",
    title: "Uncomplete Visit",
    description: "Reverse a completed visit back to incomplete.",
    mutation: "visitUncomplete",
    args: [{ name: "visitId", type: "EncodedId!" }],
    payload: VISIT_PAYLOAD,
  },
  {
    tool: "jobber_delete_visits",
    title: "Delete Visits",
    description: "Delete one or more visits.",
    mutation: "visitDelete",
    args: [{ name: "visitIds", type: "[EncodedId!]!" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_create_visit_line_items",
    title: "Add Line Items to Visit",
    description: "Append line items to a visit.",
    mutation: "visitCreateLineItems",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "VisitCreateLineItemInput!" },
    ],
    payload: `visit { id }`,
  },
  {
    tool: "jobber_edit_visit_line_items",
    title: "Edit Visit Line Items",
    description: "Edit line items on a visit.",
    mutation: "visitEditLineItems",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "VisitEditLineItemsInput!" },
    ],
    payload: `visit { id }`,
  },
  {
    tool: "jobber_delete_visit_line_items",
    title: "Delete Visit Line Items",
    description: "Remove line items from a visit.",
    mutation: "visitDeleteLineItems",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "VisitDeleteLineItemsInput!" },
    ],
    payload: `visit { id }`,
  },
  {
    tool: "jobber_update_future_visits",
    title: "Update Future Visits",
    description: "Bulk-update upcoming visits on a recurring job.",
    mutation: "updateFutureVisits",
    args: [{ name: "input", type: "UpdateFutureVisitsInput!" }],
    payload: `visits { id }`,
  },
  {
    tool: "jobber_create_on_my_way_link",
    title: "Create On-My-Way Tracking Link",
    description: "Generate a tracking link for a visit so the customer can see ETA.",
    mutation: "onMyWayTrackingLinkCreate",
    args: [
      { name: "visitId", type: "EncodedId!" },
      { name: "input", type: "OnMyWayTrackingLinkCreateInput!" },
    ],
    payload: `onMyWayTrackingLink { id url }`,
  },

  // ─── Assessments ────────────────────────────────────────────────────────
  {
    tool: "jobber_create_assessment",
    title: "Create Assessment",
    description: "Create an assessment on a request.",
    mutation: "assessmentCreate",
    args: [
      { name: "requestId", type: "EncodedId!" },
      { name: "input", type: "AssessmentCreateInput!" },
    ],
    payload: ASSESSMENT_PAYLOAD,
  },
  {
    tool: "jobber_update_assessment",
    title: "Update Assessment",
    description: "Edit an assessment.",
    mutation: "assessmentEdit",
    args: [
      { name: "assessmentId", type: "EncodedId!" },
      { name: "input", type: "AssessmentEditInput!" },
    ],
    payload: ASSESSMENT_PAYLOAD,
  },
  {
    tool: "jobber_complete_assessment",
    title: "Complete Assessment",
    description: "Mark an assessment as complete.",
    mutation: "assessmentComplete",
    args: [{ name: "assessmentId", type: "EncodedId!" }],
    payload: ASSESSMENT_PAYLOAD,
  },
  {
    tool: "jobber_uncomplete_assessment",
    title: "Uncomplete Assessment",
    description: "Reverse a completed assessment.",
    mutation: "assessmentUncomplete",
    args: [{ name: "assessmentId", type: "EncodedId!" }],
    payload: ASSESSMENT_PAYLOAD,
  },
  {
    tool: "jobber_delete_assessment",
    title: "Delete Assessment",
    description: "Delete an assessment.",
    mutation: "assessmentDelete",
    args: [{ name: "assessmentId", type: "EncodedId!" }],
    payload: PAYLOAD_NONE,
  },

  // ─── Properties ─────────────────────────────────────────────────────────
  {
    tool: "jobber_create_property",
    title: "Create Property",
    description: "Add a service property to an existing client.",
    mutation: "propertyCreate",
    args: [
      { name: "clientId", type: "EncodedId!" },
      { name: "input", type: "PropertyCreateInput!", description: "{ address: { street1, street2, city, province, postalCode, country }, ... }" },
    ],
    payload: PROPERTY_PAYLOAD,
  },
  {
    tool: "jobber_update_property",
    title: "Update Property",
    description: "Edit an existing property.",
    mutation: "propertyEdit",
    args: [
      { name: "propertyId", type: "EncodedId!" },
      { name: "input", type: "PropertyEditInput!" },
    ],
    payload: PROPERTY_PAYLOAD,
  },

  // ─── Expenses ───────────────────────────────────────────────────────────
  {
    tool: "jobber_create_expense",
    title: "Create Expense",
    description: "Log an expense.",
    mutation: "expenseCreate",
    args: [{ name: "input", type: "ExpenseCreateInput!", description: "{ title, description, total, date, paidByUserId, reimbursableToUserId, linkedJobId, ... }" }],
    payload: EXPENSE_PAYLOAD,
  },
  {
    tool: "jobber_update_expense",
    title: "Update Expense",
    description: "Edit an expense.",
    mutation: "expenseEdit",
    args: [
      { name: "expenseId", type: "EncodedId!" },
      { name: "input", type: "ExpenseEditInput!" },
    ],
    payload: EXPENSE_PAYLOAD,
  },
  {
    tool: "jobber_delete_expense",
    title: "Delete Expense",
    description: "Delete an expense.",
    mutation: "expenseDelete",
    args: [{ name: "expenseId", type: "EncodedId!" }],
    payload: PAYLOAD_NONE,
  },

  // ─── Products & Services ────────────────────────────────────────────────
  {
    tool: "jobber_create_product_or_service",
    title: "Create Product or Service",
    description: "Add a product/service to your catalog.",
    mutation: "productsAndServicesCreate",
    args: [{ name: "input", type: "ProductsAndServicesInput!", description: "{ name, description, defaultUnitCost, markup, taxable, visible, ... }" }],
    payload: PRODUCT_PAYLOAD,
  },
  {
    tool: "jobber_update_product_or_service",
    title: "Update Product or Service",
    description: "Edit a product/service in your catalog.",
    mutation: "productsAndServicesEdit",
    args: [
      { name: "productOrServiceId", type: "EncodedId!" },
      { name: "input", type: "ProductsAndServicesEditInput!" },
    ],
    payload: PRODUCT_PAYLOAD,
  },

  // ─── Tasks ──────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_task",
    title: "Create Task",
    description: "Create a task. clientId/propertyId are optional but commonly used.",
    mutation: "taskCreate",
    args: [
      { name: "clientId", type: "EncodedId" },
      { name: "propertyId", type: "EncodedId" },
      { name: "input", type: "TaskCreateInput!", description: "{ title, description, startAt, endAt, assignedUserIds, ... }" },
    ],
    payload: TASK_PAYLOAD,
  },
  {
    tool: "jobber_update_task",
    title: "Update Task",
    description: "Edit a task.",
    mutation: "taskEdit",
    args: [
      { name: "taskId", type: "EncodedId!" },
      { name: "input", type: "TaskEditInput!" },
    ],
    payload: TASK_PAYLOAD,
  },
  {
    tool: "jobber_delete_tasks",
    title: "Delete Tasks",
    description: "Delete one or more tasks.",
    mutation: "taskDelete",
    args: [
      { name: "taskIds", type: "[EncodedId!]!" },
      { name: "deleteFutureRecurring", type: "Boolean", description: "If true, also delete future occurrences for recurring tasks." },
    ],
    payload: PAYLOAD_NONE,
  },

  // ─── Events ─────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_event",
    title: "Create Event",
    description: "Create a calendar event.",
    mutation: "eventCreate",
    args: [{ name: "input", type: "EventCreateInput!" }],
    payload: `event { id }`,
  },

  // ─── Appointments (cross-cutting) ───────────────────────────────────────
  {
    tool: "jobber_edit_appointment_assignment",
    title: "Edit Appointment Assignment",
    description: "Change team-member assignment on a task/visit/assessment.",
    mutation: "appointmentEditAssignment",
    args: [
      { name: "appointmentId", type: "EncodedId!" },
      { name: "input", type: "AppointmentEditAssignmentInput!" },
    ],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_edit_appointment_completeness",
    title: "Edit Appointment Completeness",
    description: "Mark an appointment complete or incomplete.",
    mutation: "appointmentEditCompleteness",
    args: [
      { name: "appointmentId", type: "EncodedId!" },
      { name: "input", type: "AppointmentEditCompletenessInput!" },
    ],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_edit_appointment_schedule",
    title: "Edit Appointment Schedule",
    description: "Edit the schedule (start/end) of any appointment type.",
    mutation: "appointmentEditSchedule",
    args: [
      { name: "appointmentId", type: "EncodedId!" },
      { name: "input", type: "AppointmentEditScheduleInput!" },
    ],
    payload: PAYLOAD_NONE,
  },

  // ─── Taxes ──────────────────────────────────────────────────────────────
  {
    tool: "jobber_create_tax",
    title: "Create Tax",
    description: "Create a tax rate.",
    mutation: "taxCreate",
    args: [{ name: "input", type: "TaxCreateInput!" }],
    payload: `tax { id label }`,
  },
  {
    tool: "jobber_create_tax_group",
    title: "Create Tax Group",
    description: "Create a tax group (for combined tax rates).",
    mutation: "taxGroupCreate",
    args: [{ name: "input", type: "TaxGroupCreateInput!" }],
    payload: `taxGroup { id label }`,
  },

  // ─── Users ──────────────────────────────────────────────────────────────
  {
    tool: "jobber_update_user",
    title: "Update User",
    description: "Edit a user (team member).",
    mutation: "userEdit",
    args: [
      { name: "userId", type: "EncodedId!" },
      { name: "input", type: "UserEditInput!" },
    ],
    payload: USER_PAYLOAD,
  },

  // ─── Custom Field Configurations ────────────────────────────────────────
  {
    tool: "jobber_create_custom_field_text",
    title: "Create Text Custom Field Config",
    description: "Define a new text custom-field configuration.",
    mutation: "customFieldConfigurationCreateText",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateTextInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_create_custom_field_area",
    title: "Create Area Custom Field Config",
    description: "Define a new area (sq ft / sq m) custom-field configuration.",
    mutation: "customFieldConfigurationCreateArea",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateAreaInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_create_custom_field_dropdown",
    title: "Create Dropdown Custom Field Config",
    description: "Define a new dropdown custom-field configuration.",
    mutation: "customFieldConfigurationCreateDropdown",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateDropdownInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_create_custom_field_link",
    title: "Create Link Custom Field Config",
    description: "Define a new link custom-field configuration.",
    mutation: "customFieldConfigurationCreateLink",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateLinkInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_create_custom_field_numeric",
    title: "Create Numeric Custom Field Config",
    description: "Define a new numeric custom-field configuration.",
    mutation: "customFieldConfigurationCreateNumeric",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateNumericInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_create_custom_field_true_false",
    title: "Create True/False Custom Field Config",
    description: "Define a new boolean custom-field configuration.",
    mutation: "customFieldConfigurationCreateTrueFalse",
    args: [{ name: "input", type: "CustomFieldConfigurationCreateTrueFalseInput!" }],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_edit_custom_field",
    title: "Edit Custom Field Config",
    description: "Edit a custom-field configuration.",
    mutation: "customFieldConfigurationEdit",
    args: [
      { name: "customFieldConfigurationId", type: "EncodedId!" },
      { name: "input", type: "CustomFieldConfigurationEditInput!" },
    ],
    payload: `customFieldConfiguration { id label }`,
  },
  {
    tool: "jobber_archive_custom_fields",
    title: "Archive Custom Field Configs",
    description: "Archive one or more custom-field configurations.",
    mutation: "customFieldConfigurationArchive",
    args: [{ name: "customFieldConfigurationIds", type: "[EncodedId!]!" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_unarchive_custom_fields",
    title: "Unarchive Custom Field Configs",
    description: "Unarchive one or more custom-field configurations.",
    mutation: "customFieldConfigurationUnarchive",
    args: [{ name: "customFieldConfigurationIds", type: "[EncodedId!]!" }],
    payload: PAYLOAD_NONE,
  },

  // ─── Webhooks ───────────────────────────────────────────────────────────
  {
    tool: "jobber_create_webhook_endpoint",
    title: "Create Webhook Endpoint",
    description: "Subscribe to Jobber events. Provide a URL Jobber will POST to.",
    mutation: "webhookEndpointCreate",
    args: [{ name: "input", type: "WebhookEndpointCreateInput!", description: "{ url, topics: [WebhookTopicEnum!]! }" }],
    payload: WEBHOOK_PAYLOAD,
  },
  {
    tool: "jobber_delete_webhook_endpoints",
    title: "Delete Webhook Endpoints",
    description: "Unsubscribe from Jobber events by deleting endpoint(s).",
    mutation: "webhookEndpointDelete",
    args: [{ name: "webhookEndpointsIds", type: "[EncodedId!]!" }],
    payload: PAYLOAD_NONE,
  },

  // ─── Vehicles ───────────────────────────────────────────────────────────
  {
    tool: "jobber_create_vehicle",
    title: "Create Vehicle",
    description: "Add a vehicle to the fleet.",
    mutation: "vehicleCreate",
    args: [{ name: "input", type: "VehicleCreateInput!" }],
    payload: `vehicle { id }`,
  },
  {
    tool: "jobber_update_vehicles",
    title: "Update Vehicles",
    description: "Bulk-update vehicles.",
    mutation: "vehiclesUpdate",
    args: [{ name: "input", type: "VehiclesUpdateInput!" }],
    payload: `vehicles { id }`,
  },
  {
    tool: "jobber_delete_vehicle",
    title: "Delete Vehicle",
    description: "Delete a vehicle.",
    mutation: "vehicleDelete",
    args: [{ name: "vehicleId", type: "EncodedId!" }],
    payload: PAYLOAD_NONE,
  },

  // ─── Supplier Invoice ingestion ─────────────────────────────────────────
  {
    tool: "jobber_upload_supplier_invoice",
    title: "Upload Supplier Invoice PDF",
    description: "Upload a supplier invoice PDF for automated processing. Provide a signedBlobId obtained from Jobber's Files API.",
    mutation: "supplierInvoiceUpload",
    args: [{ name: "signedBlobIds", type: "[EncodedId!]!" }],
    payload: `documents { id }`,
  },
  {
    tool: "jobber_retry_supplier_invoice_document",
    title: "Retry Supplier Invoice Processing",
    description: "Retry processing for a failed supplier-invoice document.",
    mutation: "supplierInvoiceDocumentRetry",
    args: [{ name: "documentId", type: "EncodedId!" }],
    payload: `document { id }`,
  },

  // ─── App / Integration / Marketing ──────────────────────────────────────
  {
    tool: "jobber_app_disconnect",
    title: "Disconnect App",
    description: "Forcefully remove this app's connection from the requesting account.",
    mutation: "appDisconnect",
    args: [],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_edit_app_alert",
    title: "Edit App Alert",
    description: "Edit alerts for the connected account.",
    mutation: "appAlertEdit",
    args: [{ name: "input", type: "AppAlertEditInput!" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_edit_app_last_sync_date",
    title: "Edit App Last-Sync Date",
    description: "Update the last-sync-date metadata for the connected app instance.",
    mutation: "appInstanceLastSyncDateEdit",
    args: [{ name: "input", type: "LastSyncDateEditInput!" }],
    payload: PAYLOAD_NONE,
  },
  {
    tool: "jobber_update_marketing_channel_profile",
    title: "Update Marketing Channel Profile",
    description: "Edit third-party integration metadata for a connected marketing app instance.",
    mutation: "marketingUpdateChannelProfile",
    args: [{ name: "input", type: "MarketingUpdateChannelProfileInput!" }],
    payload: PAYLOAD_NONE,
  },
];
