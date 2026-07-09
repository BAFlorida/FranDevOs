import {
  db,
  focusAreasTable,
  focusAreaTargetsTable,
  usersTable,
  projectsTable,
  tasksTable,
  recurringMetricsTable,
  metricEntriesTable,
  groupsTable,
  groupMembersTable,
  kpiAuditEntriesTable,
  crmConnectionsTable,
  crmAccountsTable,
  crmPeopleTable,
  crmOpportunitiesTable,
  crmCampaignsTable,
  crmEmailActivityTable,
  crmSyncEventsTable,
  crmTaskLinksTable,
  reportDefinitionsTable,
  CRM_STAGE_VOCABULARY,
} from "@workspace/db";
import { sql } from "drizzle-orm";

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

function priorMonday(weeks: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return mondayOf(d);
}

const FOCUS_AREAS = [
  "1 – Unified Development System",
  "2 – Top-of-Funnel Lead Gen",
  "3 – Broker Channel",
  "4 – Portfolio Brand Strategy",
  "5 – Operational Infrastructure",
  "6 – Automation & Content",
  "7 – Operating Rhythm",
  "8 – Talent Evaluation",
];

const USERS = [
  { name: "John Dobelbower", role: "vp", color: "#0EA5E9" },
  { name: "Quick Chadwick", role: "admin", color: "#F59E0B" },
  { name: "MaryFran Anderson", role: "lead", color: "#8B5CF6" },
  { name: "Shane Mattingly", role: "lead", color: "#10B981" },
  { name: "Leslie Toole", role: "member", color: "#EC4899" },
  { name: "Leah Hanlon", role: "member", color: "#3B82F6" },
  { name: "Jamie Lavigne", role: "member", color: "#EF4444" },
  { name: "Steve Griffith", role: "member", color: "#14B8A6" },
  { name: "Matt Motyka", role: "member", color: "#F97316" },
  { name: "Alvaro Leal", role: "member", color: "#6366F1" },
  { name: "Cassidy Ford", role: "member", color: "#84CC16" },
] as const;

function slugId(name: string): string {
  return "seed-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Map xlsx "Lead Owner" strings → seed user names (where matchable)
function leadOwnerToUser(lead: string | null): string | null {
  if (!lead) return null;
  if (/Chadwick/i.test(lead)) return "Quick Chadwick";
  if (/MF\.?\s*Anderson|MaryFran/i.test(lead)) return "MaryFran Anderson";
  if (/Mattingly/i.test(lead)) return "Shane Mattingly";
  if (/Motyka/i.test(lead)) return "Matt Motyka";
  if (/Griffith/i.test(lead)) return "Steve Griffith";
  if (/Leal/i.test(lead)) return "Alvaro Leal";
  return null;
}

interface ProjectDef {
  code: string;
  area: string;
  name: string;
  leadOwner: string | null;
  execOwner: string;
  strategicGoal: string;
}

const PROJECT_DEFS: ProjectDef[] = [
  { code: "P1-1", area: "1 – Unified Development System", name: "Implement standardized Mutual Evaluation Process (MEP) across all brands", leadOwner: "Developers", execOwner: "Dobelbower", strategicGoal: "Current franchise development processes vary significantly by brand, creating inconsistent candidate experiences and reducing scalability." },
  { code: "P1-2", area: "1 – Unified Development System", name: "Standardize pipeline stages, definitions, and reporting in CRM", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Inconsistent pipeline definitions and reporting currently limit forecasting accuracy and portfolio-level visibility." },
  { code: "P1-3", area: "1 – Unified Development System", name: "Implement DAP (Development Action Plan) timelines for all candidates", leadOwner: "Developers", execOwner: "Dobelbower", strategicGoal: "Current candidate progression lacks consistent timelines and accountability, creating unnecessary delays and reduced closing certainty." },
  { code: "P1-4", area: "1 – Unified Development System", name: "Standardize MTTD structure (confirmation event, not sales event)", leadOwner: "Developers", execOwner: "Dobelbower", strategicGoal: "MTTD execution varies significantly by brand and should function as a confirmation milestone rather than a late-stage persuasion event." },
  { code: "P1-5", area: "1 – Unified Development System", name: "Standardize lead qualification across brands (Lumin, SDR, etc.)", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Qualification standards currently vary by brand, resulting in inconsistent lead quality and inefficient developer utilization." },
  { code: "P1-6", area: "1 – Unified Development System", name: "Launch weekly portfolio-wide pipeline call (eliminate silos)", leadOwner: "Developers", execOwner: "Dobelbower", strategicGoal: "Weekly Pipeline Review kicked off 5/5." },
  { code: "P2-1", area: "2 – Top-of-Funnel Lead Gen", name: "Centralize non-broker marketing under Chadwick", leadOwner: "Chadwick", execOwner: "Dobelbower", strategicGoal: "Non-broker lead generation efforts are currently fragmented across brands and lack centralized strategic prioritization." },
  { code: "P2-2", area: "2 – Top-of-Funnel Lead Gen", name: "Reallocate spend toward non-broker sourced channels", leadOwner: "Thoma/Chadwick", execOwner: "Dobelbower", strategicGoal: "Marketing spend allocation is not consistently aligned with lead quality, conversion performance, or long-term scalability objectives." },
  { code: "P2-3", area: "2 – Top-of-Funnel Lead Gen", name: "Build video-first funnel", leadOwner: "M. Anderson/Leal", execOwner: "Dobelbower", strategicGoal: "Video and automation create an opportunity to improve candidate education, consistency, and developer scalability across all brands." },
  { code: "P2-4", area: "2 – Top-of-Funnel Lead Gen", name: "Establish portfolio-level KPIs benchmarked against AFDR ratios", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Portfolio-level KPIs are necessary to properly evaluate marketing efficiency, lead quality, and channel performance across brands." },
  { code: "P2-5", area: "2 – Top-of-Funnel Lead Gen", name: "Eliminate low-quality lead sources", leadOwner: "Chadwick", execOwner: "Dobelbower", strategicGoal: "Certain lead sources currently produce volume without corresponding conversion performance or franchisee quality." },
  { code: "P3-1", area: "3 – Broker Channel", name: "Assign MaryFran as broker channel owner", leadOwner: "MF. Anderson", execOwner: "Dobelbower", strategicGoal: "Broker relationships currently lack centralized ownership and consistent management across the portfolio." },
  { code: "P3-2", area: "3 – Broker Channel", name: "Route 100% of broker leads through CRM for centralized intake and visibility.", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Shared inboxes and inconsistent lead routing create missed opportunities and limited visibility into broker activity." },
  { code: "P3-3", area: "3 – Broker Channel", name: "Implement rules-based lead distribution", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Lead distribution should prioritize fairness, responsiveness, and performance while eliminating perception of uneven opportunity." },
  { code: "P3-4", area: "3 – Broker Channel", name: "Enforce speed-to-lead SLAs", leadOwner: "MF. Anderson", execOwner: "Dobelbower", strategicGoal: "Response speed remains one of the largest drivers of broker lead conversion and candidate engagement." },
  { code: "P3-5", area: "3 – Broker Channel", name: "Segment Brokers into Tier 1/Tier 2/Tier 3", leadOwner: "MF. Anderson", execOwner: "Dobelbower", strategicGoal: "Not all broker relationships generate equal value, requiring prioritization based on production and lead quality." },
  { code: "P3-6", area: "3 – Broker Channel", name: "Introduce performance-based lead weighting", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Lead distribution should reward execution and conversion performance while maintaining equitable opportunity across the team." },
  { code: "P3-7", area: "3 – Broker Channel", name: "Build weekly broker channel performance reporting", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Broker performance visibility is currently limited, making it difficult to optimize relationships and conversion performance." },
  { code: "P4-1", area: "4 – Portfolio Brand Strategy", name: "Position The Seals as a low-cost, high-whitespace growth brand", leadOwner: "Anderson/Chadwick", execOwner: "Dobelbower", strategicGoal: "The Seals presents an opportunity for accelerated unit growth due to low investment requirements, recurring revenue characteristics, and significant whitespace availability." },
  { code: "P4-2", area: "4 – Portfolio Brand Strategy", name: "Position 1-Tom as a flagship growth brand", leadOwner: "Anderson/Chadwick", execOwner: "Dobelbower", strategicGoal: "1-Tom possesses strong branding, broad market appeal, and favorable long-term scalability characteristics." },
  { code: "P4-3", area: "4 – Portfolio Brand Strategy", name: "Align Kitchen Guard growth strategy with Strategic Accounts initiatives", leadOwner: "Hatcher", execOwner: "Dobelbower", strategicGoal: "Kitchen Guard's compliance-driven recurring revenue model aligns well with enterprise and Strategic Account positioning opportunities." },
  { code: "P4-4", area: "4 – Portfolio Brand Strategy", name: "Reposition Prism as a multi-service platform opportunity", leadOwner: "Anderson/Chadwick", execOwner: "Dobelbower", strategicGoal: "Prism's multi-service structure creates an opportunity to increase average deal size and long-term franchisee value." },
  { code: "P4-5", area: "4 – Portfolio Brand Strategy", name: "Maintain stable, quality-focused growth for U.S. Lawns", leadOwner: "Steeves", execOwner: "Dobelbower", strategicGoal: "U.S. Lawns serves as a mature and stable portfolio brand with strong recognition and operational consistency." },
  { code: "P4-6", area: "4 – Portfolio Brand Strategy", name: "Utilize Clintar as a selective strategic growth vehicle", leadOwner: "Motyka", execOwner: "Dobelbower", strategicGoal: "Clintar should be positioned toward experienced operators and strategic opportunities rather than high-volume franchise sales efforts." },
  { code: "P4-7", area: "4 – Portfolio Brand Strategy", name: "Rebuild validation and franchisee confidence within MilliCare", leadOwner: "Griffith/Weaver", execOwner: "Dobelbower", strategicGoal: "Long-term MilliCare growth requires improvement in franchisee sentiment, validation consistency, and economic confidence." },
  { code: "P5-1", area: "5 – Operational Infrastructure", name: "Replace shared territory check inboxes with CRM routing", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Shared territory check workflows currently create operational inefficiencies and inconsistent response times." },
  { code: "P5-2", area: "5 – Operational Infrastructure", name: "Implement territory check response SLA", leadOwner: "MF. Anderson", execOwner: "Dobelbower", strategicGoal: "Fast and consistent response times are critical to broker experience and franchise sales momentum." },
  { code: "P5-3", area: "5 – Operational Infrastructure", name: "Standardize lead assignment and routing logic", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Lead routing should prioritize transparency, accountability, and operational consistency across brands." },
  { code: "P5-4", area: "5 – Operational Infrastructure", name: "Build centralized KPI dashboard and reporting visibility", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Leadership currently lacks consistent portfolio-wide visibility into funnel health and conversion trends." },
  { code: "P5-5", area: "5 – Operational Infrastructure", name: "Improve CRM adoption and reporting discipline", leadOwner: "Developers", execOwner: "Dobelbower/Mattingly", strategicGoal: "Consistent CRM usage is required to improve forecasting accuracy and operational visibility." },
  { code: "P6-1", area: "6 – Automation & Content", name: "Develop standardized brand overview videos", leadOwner: "M Anderson/Leal", execOwner: "Dobelbower", strategicGoal: "Standardized brand messaging improves candidate consistency and reduces repetitive developer workload." },
  { code: "P6-2", area: "6 – Automation & Content", name: "Develop validation preparation and candidate education content", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "Better-prepared candidates improve validation outcomes and increase overall process efficiency." },
  { code: "P6-3", area: "6 – Automation & Content", name: "Create standardized FDD and process walkthrough videos", leadOwner: "M Anderson/Leal", execOwner: "Dobelbower", strategicGoal: "Automation of repetitive educational content increases scalability and developer capacity." },
  { code: "P6-4", area: "6 – Automation & Content", name: "Build centralized content library across brands", leadOwner: "M Anderson/Leal", execOwner: "Dobelbower", strategicGoal: "Centralized content infrastructure improves consistency and speed of deployment across the portfolio." },
  { code: "P6-5", area: "6 – Automation & Content", name: "Automate early-stage candidate education", leadOwner: "Mattingly/Ruhlig", execOwner: "Dobelbower", strategicGoal: "Automation creates operational leverage while improving consistency of the candidate experience." },
  { code: "P7-1", area: "7 – Operating Rhythm", name: "Implement weekly KPI scorecards by brand, developer, and source", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Transparent performance reporting improves visibility and operational decision-making." },
  { code: "P7-2", area: "7 – Operating Rhythm", name: "Conduct monthly funnel conversion and marketing reviews", leadOwner: "Chadwick/MF Anderson", execOwner: "Dobelbower", strategicGoal: "Regular conversion analysis is necessary to optimize marketing efficiency and franchise development performance." },
  { code: "P7-3", area: "7 – Operating Rhythm", name: "Standardize forecasting methodology", leadOwner: "Mattingly", execOwner: "Dobelbower", strategicGoal: "Forecasting methodologies currently vary across brands, limiting portfolio-level planning and visibility." },
  { code: "P7-4", area: "7 – Operating Rhythm", name: "Establish clear initiative ownership and accountability", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "Consistent ownership structures are required to improve execution discipline and cross-functional alignment." },
  { code: "P8-1", area: "8 – Talent Evaluation", name: "Evaluate the current Franchise Development team to identify top performers, growth opportunities, and long-term leadership potential.", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "This assessment will help ensure the organization has the right talent structure in place to support scalable growth across all brands." },
  { code: "P8-2", area: "8 – Talent Evaluation", name: "Establish standardized performance expectations and KPI accountability across all Franchise Development roles.", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "Creating consistent scorecards and benchmarks will improve visibility, alignment, and operational discipline throughout the department." },
  { code: "P8-3", area: "8 – Talent Evaluation", name: "Identify capability gaps and organizational needs across recruiting, sales execution, broker management, and lead conversion.", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "Understanding where additional support, training, or restructuring is needed will strengthen overall development effectiveness." },
  { code: "P8-4", area: "8 – Talent Evaluation", name: "Build a long-term talent development strategy focused on coaching, succession planning, and cross-brand collaboration.", leadOwner: "Dobelbower", execOwner: "N/A", strategicGoal: "Investing in team development will create a more scalable and sustainable franchise development organization over time." },
];

type TaskRole = "Owner" | "Contributor" | "Support";
type TaskPriority = "Critical" | "High" | "Medium" | "Low";
type TaskStatus = "Not Started" | "In Progress" | "Waiting on Someone" | "Blocked" | "Complete";

interface TaskDef {
  project: string;
  assignee: string;
  role: TaskRole;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  percent: number;
  startDate: string | null;
  dueDate: string | null;
  dependency?: string;
  roadblock?: string;
  lastUpdate?: string;
  nextStep?: string;
}

const TASK_DEFS: TaskDef[] = [
  // Quick Chadwick (10)
  { project: "P2-2", assignee: "Quick Chadwick", role: "Owner", description: "Develop Marketing Spend Reallocation Plan", priority: "High", status: "Complete", percent: 100, startDate: "2026-05-05", dueDate: "2026-05-22", lastUpdate: "Reviewed plan; edits suggested & incorporated", nextStep: "Monitor reallocated spend vs broker channels" },
  { project: "P1-1", assignee: "Quick Chadwick", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P2-3", assignee: "Quick Chadwick", role: "Owner", description: "Video Coordination with Madsen Anderson", priority: "High", status: "In Progress", percent: 30, startDate: "2026-05-15", dueDate: "2026-06-20", lastUpdate: "Coordinating shoot schedule", nextStep: "Lock production calendar" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – 1-Tom)", priority: "High", status: "Complete", percent: 100, startDate: "2026-05-01", dueDate: "2026-05-20", lastUpdate: "Completed", nextStep: "Publish to content library" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – The Seals)", priority: "Medium", status: "In Progress", percent: 40, startDate: "2026-05-10", dueDate: "2026-06-30", lastUpdate: "JL has sample; could be used as sub", nextStep: "Confirm sub footage with Jamie" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – Kitchen Guard)", priority: "Medium", status: "In Progress", percent: 25, startDate: "2026-05-10", dueDate: "2026-07-15", lastUpdate: "Could use Bytes & Insights for sub", nextStep: "Source sub footage" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – MilliCare)", priority: "Medium", status: "Not Started", percent: 0, startDate: "2026-06-01", dueDate: "2026-07-31", dependency: "Coordinate with Steve Griffith", nextStep: "Kickoff with SG" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – Prism)", priority: "Medium", status: "In Progress", percent: 40, startDate: "2026-05-10", dueDate: "2026-06-30", lastUpdate: "JL has sample", nextStep: "Confirm sub footage" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – Clintar)", priority: "Medium", status: "In Progress", percent: 30, startDate: "2026-05-10", dueDate: "2026-07-15", lastUpdate: "Could use TES for sub", nextStep: "Source sub footage" },
  { project: "P6-1", assignee: "Quick Chadwick", role: "Owner", description: "Video Project (Signature 7 – US Lawns)", priority: "Medium", status: "Not Started", percent: 0, startDate: "2026-06-01", dueDate: "2026-07-31", dependency: "Coordinate with JS", nextStep: "Kickoff with JS" },

  // MaryFran Anderson (6)
  { project: "P1-1", assignee: "MaryFran Anderson", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P3-2", assignee: "MaryFran Anderson", role: "Owner", description: "Broker Portal Update", priority: "High", status: "In Progress", percent: 40, startDate: "2026-05-12", dueDate: "2026-06-03", lastUpdate: "Updating broker portal records", nextStep: "Finalize portal field mapping" },
  { project: "P3-1", assignee: "MaryFran Anderson", role: "Owner", description: "Broker Engagement Opportunities (membership opps)", priority: "Medium", status: "In Progress", percent: 30, startDate: "2026-05-12", dueDate: "2026-06-15", lastUpdate: "Coordinating with Chadwick", nextStep: "Identify missed membership opportunities" },
  { project: "P3-1", assignee: "MaryFran Anderson", role: "Owner", description: "Broker Outreach Campaign (HubSpot drip build)", priority: "High", status: "Blocked", percent: 10, startDate: "2026-06-01", dueDate: "2026-06-27", dependency: "HubSpot drip assets from QC", roadblock: "Waiting on HubSpot drip assets from Chadwick", lastUpdate: "Coordinate with QC", nextStep: "Unblock drip assets, then define sequence" },
  { project: "P3-1", assignee: "MaryFran Anderson", role: "Owner", description: "In-Person Broker D-Day Event Planning", priority: "Medium", status: "Not Started", percent: 0, startDate: "2026-06-15", dueDate: "2026-08-15", lastUpdate: "Not started", nextStep: "Draft event concept & budget" },
  { project: "P3-4", assignee: "MaryFran Anderson", role: "Owner", description: "Enforce speed-to-lead SLAs", priority: "High", status: "In Progress", percent: 20, startDate: "2026-05-20", dueDate: "2026-06-20", lastUpdate: "Defining SLA thresholds", nextStep: "Publish SLA standard to broker team" },

  // Shane Mattingly (7)
  { project: "P1-1", assignee: "Shane Mattingly", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P1-2", assignee: "Shane Mattingly", role: "Owner", description: "Standardize pipeline stages, definitions & reporting in CRM", priority: "Critical", status: "In Progress", percent: 50, startDate: "2026-05-01", dueDate: "2026-05-26", lastUpdate: "Draft stage definitions circulated", nextStep: "Finalize stage definitions & lock CRM config" },
  { project: "P3-2", assignee: "Shane Mattingly", role: "Owner", description: "Route 100% of broker leads through CRM", priority: "High", status: "In Progress", percent: 40, startDate: "2026-05-05", dueDate: "2026-06-20", dependency: "Broker portal update (MFA)", lastUpdate: "Building intake routing", nextStep: "Test routing with sample broker leads" },
  { project: "P5-4", assignee: "Shane Mattingly", role: "Owner", description: "Build centralized KPI dashboard & reporting visibility", priority: "Critical", status: "Not Started", percent: 0, startDate: "2026-06-01", dueDate: "2026-07-18", dependency: "Pipeline stage standardization (P1-2)", lastUpdate: "Pending stage standardization", nextStep: "Spec dashboard KPIs" },
  { project: "P7-1", assignee: "Shane Mattingly", role: "Owner", description: "Implement weekly KPI scorecards by brand, developer & source", priority: "High", status: "In Progress", percent: 30, startDate: "2026-05-10", dueDate: "2026-06-27", lastUpdate: "Scorecard v1 drafted", nextStep: "Automate weekly refresh" },
  { project: "P7-3", assignee: "Shane Mattingly", role: "Owner", description: "Standardize forecasting methodology", priority: "High", status: "In Progress", percent: 20, startDate: "2026-05-15", dueDate: "2026-07-03", lastUpdate: "Reviewing brand forecast inputs", nextStep: "Align methodology across brands" },
  { project: "P3-3", assignee: "Shane Mattingly", role: "Owner", description: "Implement rules-based lead distribution", priority: "Medium", status: "Not Started", percent: 0, startDate: "2026-06-10", dueDate: "2026-07-25", lastUpdate: "Not started", nextStep: "Define distribution rules" },

  // Leslie Toole (1)
  { project: "P1-1", assignee: "Leslie Toole", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },

  // Leah Hanlon (1)
  { project: "P1-1", assignee: "Leah Hanlon", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },

  // Jamie Lavigne (2)
  { project: "P1-1", assignee: "Jamie Lavigne", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P6-1", assignee: "Jamie Lavigne", role: "Support", description: "Provide Signature 7 sample / sub footage", priority: "Low", status: "In Progress", percent: 50, startDate: "2026-05-10", dueDate: "2026-06-20", lastUpdate: "Sample available for The Seals & Prism", nextStep: "Share footage with Chadwick" },

  // Steve Griffith (2)
  { project: "P1-1", assignee: "Steve Griffith", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P4-7", assignee: "Steve Griffith", role: "Owner", description: "Rebuild validation & franchisee confidence within MilliCare", priority: "High", status: "In Progress", percent: 20, startDate: "2026-05-10", dueDate: "2026-09-30", roadblock: "Franchisee sentiment low; validation inconsistent", lastUpdate: "Mapping current validators", nextStep: "Build validator readiness plan" },

  // Matt Motyka (2)
  { project: "P1-1", assignee: "Matt Motyka", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P4-6", assignee: "Matt Motyka", role: "Owner", description: "Position Clintar as a selective strategic growth vehicle", priority: "Medium", status: "In Progress", percent: 30, startDate: "2026-05-10", dueDate: "2026-08-15", lastUpdate: "Defining target operator profile", nextStep: "Draft selective growth criteria" },

  // Alvaro Leal (3)
  { project: "P2-3", assignee: "Alvaro Leal", role: "Contributor", description: "Video Coordination with Madsen Anderson", priority: "High", status: "In Progress", percent: 30, startDate: "2026-05-15", dueDate: "2026-06-20", lastUpdate: "Coordinating with Chadwick", nextStep: "Align on shot list" },
  { project: "P1-1", assignee: "Alvaro Leal", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
  { project: "P6-1", assignee: "Alvaro Leal", role: "Owner", description: "Video Project (Signature 7 – 1-Tom)", priority: "High", status: "Complete", percent: 100, startDate: "2026-05-01", dueDate: "2026-05-20", lastUpdate: "Complete", nextStep: "Hand off final cut to library" },

  // Cassidy Ford (1)
  { project: "P1-1", assignee: "Cassidy Ford", role: "Contributor", description: "Training Section 1-3 in Fran Dev 101", priority: "Medium", status: "In Progress", percent: 50, startDate: "2026-05-20", dueDate: "2026-06-13", lastUpdate: "Assigned 5/20", nextStep: "Complete sections 2-3" },
];

async function main() {
  await db.execute(
    sql`TRUNCATE TABLE report_definitions, crm_task_links, crm_sync_events, crm_email_activity, crm_campaigns, crm_opportunities, crm_people, crm_accounts, crm_connections, kpi_audit_entries, week_lock_overrides, group_members, groups, metric_entries, recurring_metrics, focus_area_targets, tasks, projects, focus_areas RESTART IDENTITY CASCADE`,
  );

  const insertedAreas = await db
    .insert(focusAreasTable)
    .values(FOCUS_AREAS.map((name, i) => ({ name, sortOrder: i + 1 })))
    .returning();
  const areaByName = new Map(insertedAreas.map((a) => [a.name, a]));

  for (const u of USERS) {
    const id = slugId(u.name);
    await db
      .insert(usersTable)
      .values({
        id,
        email: id.replace("seed-", "") + "@franchisedev.example",
        firstName: u.name.split(" ")[0],
        lastName: u.name.split(" ").slice(1).join(" "),
        displayName: u.name,
        role: u.role,
        avatarColor: u.color,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          displayName: u.name,
          role: u.role,
          avatarColor: u.color,
        },
      });
  }
  const userByName = new Map<string, string>(
    USERS.map((u) => [u.name, slugId(u.name)] as [string, string]),
  );

  for (const p of PROJECT_DEFS) {
    const area = areaByName.get(p.area);
    if (!area) throw new Error(`Missing area ${p.area}`);
    const leadName = leadOwnerToUser(p.leadOwner);
    const execOwnerId = leadName ? userByName.get(leadName) ?? null : null;
    await db.insert(projectsTable).values({
      id: p.code,
      name: p.name,
      focusAreaId: area.id,
      executiveOwnerId: execOwnerId,
      strategicGoal: p.strategicGoal,
    });
  }

  for (const t of TASK_DEFS) {
    const assignee = userByName.get(t.assignee);
    if (!assignee) throw new Error(`Missing user ${t.assignee}`);
    await db.insert(tasksTable).values({
      projectId: t.project,
      assigneeId: assignee,
      role: t.role,
      description: t.description,
      priority: t.priority,
      status: t.status,
      percentComplete: t.percent,
      startDate: t.startDate,
      dueDate: t.dueDate,
      dependency: t.dependency ?? null,
      roadblock: t.roadblock ?? null,
      lastUpdate: t.lastUpdate ?? null,
      nextStep: t.nextStep ?? null,
    });
  }

  const insertedMetrics = await db.insert(recurringMetricsTable).values([
    {
      name: "Referral Partner Outreach",
      description: "Outbound contacts with referral / broker partners",
      targetCount: 10,
      cadence: "weekly",
      appliesTo: "developers",
    },
    {
      name: "Candidate Discovery Calls",
      description: "Qualification calls with new candidates",
      targetCount: 5,
      cadence: "weekly",
      appliesTo: "developers",
    },
  ]).returning();

  // ----- Focus area targets -----
  const FA_TARGETS: Record<string, { goal: string; target: number; current: number; unit: string }> = {
    "1 – Unified Development System": { goal: "Standardize all 8 brands on MEP, DAP, and unified pipeline stages by Q4", target: 8, current: 3, unit: "brands aligned" },
    "2 – Top-of-Funnel Lead Gen": { goal: "Drive non-broker sourced lead share from 18% → 40% by year-end", target: 40, current: 22, unit: "% non-broker share" },
    "3 – Broker Channel": { goal: "12 new units signed via broker channel in 2026; $1.2M royalty run-rate", target: 12, current: 4, unit: "units signed" },
    "4 – Portfolio Brand Strategy": { goal: "All 7 brands have clear positioning + targeted operator profile documented", target: 7, current: 4, unit: "brands positioned" },
    "5 – Operational Infrastructure": { goal: "100% of broker leads in CRM with SLA tracking by Q3", target: 100, current: 40, unit: "% in CRM" },
    "6 – Automation & Content": { goal: "Signature 7 video library complete across 7 brands by Q4", target: 7, current: 3, unit: "brands complete" },
    "7 – Operating Rhythm": { goal: "Weekly KPI scorecard live; monthly funnel review cadence in place by Q3", target: 4, current: 2, unit: "rituals live" },
    "8 – Talent Evaluation": { goal: "Complete evaluation of all 9 FD team members; KPI scorecard per role", target: 9, current: 5, unit: "people evaluated" },
  };
  for (const area of insertedAreas) {
    const t = FA_TARGETS[area.name];
    if (!t) continue;
    await db.insert(focusAreaTargetsTable).values({
      focusAreaId: area.id,
      goalText: t.goal,
      targetNumeric: t.target,
      currentNumeric: t.current,
      unitLabel: t.unit,
      updatedById: userByName.get("John Dobelbower") ?? null,
    });
  }

  // ----- Example group: "All Developers" -----
  const dobelbowerId = userByName.get("John Dobelbower")!;
  const [allDevs] = await db
    .insert(groupsTable)
    .values({
      name: "All Developers",
      description: "Every developer on the FD team — used for portfolio-wide training and initiatives.",
      createdById: dobelbowerId,
    })
    .returning();
  const developerNames = USERS.filter((u) => u.role === "member" || u.role === "lead").map((u) => u.name);
  await db.insert(groupMembersTable).values(
    developerNames.map((n) => ({ groupId: allDevs!.id, userId: userByName.get(n)! })),
  );

  // ----- Sample metric entries (current week, manual source) -----
  const thisWeek = mondayOf(new Date());
  const memberLeadUsers = USERS.filter((u) => u.role === "member" || u.role === "lead");
  // Seed sample current-week counts for each metric/developer so the UI demos with data
  for (const m of insertedMetrics) {
    for (let i = 0; i < memberLeadUsers.length; i++) {
      const u = memberLeadUsers[i]!;
      const userId = userByName.get(u.name)!;
      // Vary counts so some on target, some behind
      const baseCount = m.name.includes("Referral") ? 6 + (i % 7) : 2 + (i % 5);
      await db.insert(metricEntriesTable).values({
        metricId: m.id,
        userId,
        periodStart: thisWeek,
        count: baseCount,
        source: "manual",
        lastEvidenceNote: "Initial weekly self-report",
      });
    }
    // Prior 5 weeks for trend sparkline (first 4 developers)
    for (let w = 1; w <= 5; w++) {
      const pw = priorMonday(w);
      for (let i = 0; i < Math.min(memberLeadUsers.length, 6); i++) {
        const u = memberLeadUsers[i]!;
        const userId = userByName.get(u.name)!;
        const count = m.name.includes("Referral") ? 5 + ((i + w) % 8) : 2 + ((i + w) % 5);
        await db.insert(metricEntriesTable).values({
          metricId: m.id,
          userId,
          periodStart: pw,
          count,
          source: "manual",
          lastEvidenceNote: "Self-reported",
        });
      }
    }
  }

  // ----- Sample audit entries (current week) -----
  for (const m of insertedMetrics) {
    const sample = memberLeadUsers.slice(0, 2);
    for (const u of sample) {
      const userId = userByName.get(u.name)!;
      await db.insert(kpiAuditEntriesTable).values({
        metricId: m.id,
        userId,
        periodStart: thisWeek,
        oldCount: 0,
        newCount: 3,
        source: "manual",
        evidenceNote: "Logged 3 calls — see CRM activity",
        changedById: userId,
      });
      await db.insert(kpiAuditEntriesTable).values({
        metricId: m.id,
        userId,
        periodStart: thisWeek,
        oldCount: 3,
        newCount: 5,
        source: "manual",
        evidenceNote: "Added 2 more from end-of-day touch list",
        changedById: userId,
      });
    }
  }

  // =========================================================================
  // CRM reporting mock data (canonical tables).
  //
  // This is mock data only — provenance columns are populated as if a real
  // Salesforce / HubSpot sync had produced these rows, so the shape is
  // identical to what a future real integration will write. No external calls.
  // =========================================================================
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const [sfConnection, hsConnection] = await db
    .insert(crmConnectionsTable)
    .values([
      {
        sourceSystem: "salesforce",
        displayName: "Salesforce (Production)",
        status: "connected_mock",
        lastSyncAt: daysAgo(0),
        objectsSynced: ["accounts", "contacts", "opportunities", "campaigns"],
      },
      {
        sourceSystem: "hubspot",
        displayName: "HubSpot Marketing Hub",
        status: "connected_mock",
        lastSyncAt: daysAgo(0),
        objectsSynced: ["companies", "contacts", "deals", "campaigns", "emails"],
      },
    ])
    .returning();

  const conn = (source: "salesforce" | "hubspot") =>
    source === "salesforce" ? sfConnection!.id : hsConnection!.id;

  // ----- Accounts (candidate franchisees) split across both sources -----
  type AccountSeed = {
    source: "salesforce" | "hubspot";
    name: string;
    type: string;
    owner: string;
    region: string;
  };
  const ACCOUNT_SEEDS: AccountSeed[] = [
    { source: "salesforce", name: "Riverside Hospitality Group", type: "Multi-Unit Operator", owner: "Quick Chadwick", region: "Southeast" },
    { source: "salesforce", name: "Summit Facility Partners", type: "Single-Unit Candidate", owner: "MaryFran Anderson", region: "Midwest" },
    { source: "salesforce", name: "Beacon Service Holdings", type: "Private Equity", owner: "Shane Mattingly", region: "Northeast" },
    { source: "hubspot", name: "Greenfield Ventures LLC", type: "Multi-Unit Operator", owner: "MaryFran Anderson", region: "West" },
    { source: "hubspot", name: "Harbor Point Capital", type: "Private Equity", owner: "Quick Chadwick", region: "Southeast" },
    { source: "hubspot", name: "Cedar Lane Franchising", type: "Single-Unit Candidate", owner: "Shane Mattingly", region: "Southwest" },
  ];
  const insertedAccounts = await db
    .insert(crmAccountsTable)
    .values(
      ACCOUNT_SEEDS.map((a, i) => ({
        sourceSystem: a.source,
        sourceRecordId:
          a.source === "salesforce" ? `001AX0000${10000 + i}` : `hs-company-${5000 + i}`,
        rawPayload: { Name: a.name, Type: a.type, OwnerName: a.owner, Region: a.region },
        externalLastModifiedAt: daysAgo(i + 1),
        connectionId: conn(a.source),
        name: a.name,
        type: a.type,
        ownerName: a.owner,
        region: a.region,
      })),
    )
    .returning();
  const accountByName = new Map(insertedAccounts.map((a) => [a.name, a]));

  // ----- People (contacts / leads) -----
  type PersonSeed = {
    source: "salesforce" | "hubspot";
    first: string;
    last: string;
    title: string;
    account: string;
    owner: string;
  };
  const PEOPLE_SEEDS: PersonSeed[] = [
    { source: "salesforce", first: "Dana", last: "Whitfield", title: "Managing Partner", account: "Riverside Hospitality Group", owner: "Quick Chadwick" },
    { source: "salesforce", first: "Marcus", last: "Lee", title: "Owner", account: "Summit Facility Partners", owner: "MaryFran Anderson" },
    { source: "salesforce", first: "Priya", last: "Raman", title: "VP Acquisitions", account: "Beacon Service Holdings", owner: "Shane Mattingly" },
    { source: "hubspot", first: "Tom", last: "Becker", title: "Principal", account: "Greenfield Ventures LLC", owner: "MaryFran Anderson" },
    { source: "hubspot", first: "Alicia", last: "Gomez", title: "Investment Director", account: "Harbor Point Capital", owner: "Quick Chadwick" },
    { source: "hubspot", first: "Ryan", last: "Pelletier", title: "Founder", account: "Cedar Lane Franchising", owner: "Shane Mattingly" },
  ];
  await db.insert(crmPeopleTable).values(
    PEOPLE_SEEDS.map((p, i) => {
      const acct = accountByName.get(p.account)!;
      return {
        sourceSystem: p.source,
        sourceRecordId:
          p.source === "salesforce" ? `003AX0000${20000 + i}` : `hs-contact-${7000 + i}`,
        rawPayload: { firstname: p.first, lastname: p.last, jobtitle: p.title },
        externalLastModifiedAt: daysAgo(i + 1),
        connectionId: conn(p.source),
        firstName: p.first,
        lastName: p.last,
        email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@example.com`,
        title: p.title,
        accountId: acct.id,
        ownerName: p.owner,
      };
    }),
  );

  // ----- Opportunities: every canonical stage, from BOTH sources -----
  // Source-specific raw stage labels keyed by canonical stage.
  const SF_STAGE_RAW: Record<string, string> = {
    Prospecting: "Prospecting",
    Qualification: "Qualification",
    Discovery: "Needs Analysis",
    Proposal: "Proposal/Price Quote",
    Negotiation: "Negotiation/Review",
    "Closed Won": "Closed Won",
    "Closed Lost": "Closed Lost",
  };
  const HS_STAGE_RAW: Record<string, string> = {
    Prospecting: "appointmentscheduled",
    Qualification: "qualifiedtobuy",
    Discovery: "presentationscheduled",
    Proposal: "decisionmakerboughtin",
    Negotiation: "contractsent",
    "Closed Won": "closedwon",
    "Closed Lost": "closedlost",
  };
  const oppRows: (typeof crmOpportunitiesTable.$inferInsert)[] = [];
  const accountsBySource = {
    salesforce: insertedAccounts.filter((a) => a.sourceSystem === "salesforce"),
    hubspot: insertedAccounts.filter((a) => a.sourceSystem === "hubspot"),
  };
  (["salesforce", "hubspot"] as const).forEach((source) => {
    const rawMap = source === "salesforce" ? SF_STAGE_RAW : HS_STAGE_RAW;
    const accts = accountsBySource[source];
    CRM_STAGE_VOCABULARY.forEach((stage, si) => {
      const acct = accts[si % accts.length]!;
      const amount = 30000 + si * 15000 + (source === "hubspot" ? 5000 : 0);
      const closed = stage === "Closed Won" || stage === "Closed Lost";
      oppRows.push({
        sourceSystem: source,
        sourceRecordId:
          source === "salesforce"
            ? `006AX0000${30000 + si}`
            : `hs-deal-${9000 + si}`,
        rawPayload: { name: `${acct.name} — Franchise Deal`, stage: rawMap[stage] },
        externalLastModifiedAt: daysAgo(si + 1),
        connectionId: conn(source),
        name: `${acct.name} — ${stage}`,
        accountId: acct.id,
        ownerName: acct.ownerName,
        amount: amount.toFixed(2),
        stageCanonical: stage,
        stageRaw: rawMap[stage],
        closeDate: closed
          ? mondayOf(daysAgo(si * 3))
          : mondayOf(new Date(now.getTime() + (si + 5) * 24 * 60 * 60 * 1000)),
        lastActivityAt: daysAgo(si),
      });
    });
  });
  const insertedOpps = await db.insert(crmOpportunitiesTable).values(oppRows).returning();

  // ----- Campaigns across channels (both sources) -----
  const insertedCampaigns = await db
    .insert(crmCampaignsTable)
    .values([
      {
        sourceSystem: "salesforce",
        sourceRecordId: "701AX000040001",
        connectionId: conn("salesforce"),
        externalLastModifiedAt: daysAgo(10),
        name: "2026 Broker Referral Drive",
        channel: "Referral",
        type: "Partner Program",
        status: "In Progress",
        startDate: mondayOf(daysAgo(40)),
        endDate: mondayOf(daysAgo(-40)),
        sends: 0,
        opens: 0,
        clicks: 0,
        influencedPipeline: "420000.00",
      },
      {
        sourceSystem: "salesforce",
        sourceRecordId: "701AX000040002",
        connectionId: conn("salesforce"),
        externalLastModifiedAt: daysAgo(8),
        name: "Q2 Multi-Unit Webinar",
        channel: "Webinar",
        type: "Event",
        status: "Completed",
        startDate: mondayOf(daysAgo(30)),
        endDate: mondayOf(daysAgo(28)),
        sends: 1200,
        opens: 540,
        clicks: 180,
        influencedPipeline: "260000.00",
      },
      {
        sourceSystem: "hubspot",
        sourceRecordId: "hs-campaign-3001",
        connectionId: conn("hubspot"),
        externalLastModifiedAt: daysAgo(5),
        name: "Franchise Discovery Nurture",
        channel: "Email",
        type: "Nurture",
        status: "In Progress",
        startDate: mondayOf(daysAgo(35)),
        endDate: mondayOf(daysAgo(-20)),
        sends: 8400,
        opens: 3360,
        clicks: 924,
        influencedPipeline: "510000.00",
      },
      {
        sourceSystem: "hubspot",
        sourceRecordId: "hs-campaign-3002",
        connectionId: conn("hubspot"),
        externalLastModifiedAt: daysAgo(3),
        name: "PE Operator Paid Social",
        channel: "Paid Social",
        type: "Acquisition",
        status: "In Progress",
        startDate: mondayOf(daysAgo(20)),
        endDate: mondayOf(daysAgo(-30)),
        sends: 0,
        opens: 0,
        clicks: 2100,
        influencedPipeline: "180000.00",
      },
    ])
    .returning();
  const campaignByName = new Map(insertedCampaigns.map((c) => [c.name, c]));

  // ----- Email activity (HubSpot marketing emails) -----
  const nurture = campaignByName.get("Franchise Discovery Nurture")!;
  await db.insert(crmEmailActivityTable).values([
    {
      sourceSystem: "hubspot",
      sourceRecordId: "hs-email-4001",
      connectionId: conn("hubspot"),
      externalLastModifiedAt: daysAgo(14),
      campaignId: nurture.id,
      subject: "Is franchising right for your portfolio?",
      sends: 2800,
      opens: 1260,
      clicks: 392,
      sentAt: daysAgo(14),
    },
    {
      sourceSystem: "hubspot",
      sourceRecordId: "hs-email-4002",
      connectionId: conn("hubspot"),
      externalLastModifiedAt: daysAgo(7),
      campaignId: nurture.id,
      subject: "3 brands built for multi-unit operators",
      sends: 2800,
      opens: 1120,
      clicks: 336,
      sentAt: daysAgo(7),
    },
    {
      sourceSystem: "hubspot",
      sourceRecordId: "hs-email-4003",
      connectionId: conn("hubspot"),
      externalLastModifiedAt: daysAgo(2),
      campaignId: nurture.id,
      subject: "Book your discovery call",
      sends: 2800,
      opens: 980,
      clicks: 196,
      sentAt: daysAgo(2),
    },
  ]);

  // ----- Sync events (mock run log) -----
  await db.insert(crmSyncEventsTable).values([
    {
      connectionId: conn("salesforce"),
      sourceSystem: "salesforce",
      objectType: "opportunities",
      status: "success",
      recordsSynced: 7,
      startedAt: daysAgo(1),
      finishedAt: daysAgo(1),
      message: "Mock sync — 7 opportunities reconciled",
    },
    {
      connectionId: conn("salesforce"),
      sourceSystem: "salesforce",
      objectType: "accounts",
      status: "success",
      recordsSynced: 3,
      startedAt: daysAgo(1),
      finishedAt: daysAgo(1),
      message: "Mock sync — 3 accounts reconciled",
    },
    {
      connectionId: conn("hubspot"),
      sourceSystem: "hubspot",
      objectType: "deals",
      status: "success",
      recordsSynced: 7,
      startedAt: daysAgo(0),
      finishedAt: daysAgo(0),
      message: "Mock sync — 7 deals reconciled",
    },
    {
      connectionId: conn("hubspot"),
      sourceSystem: "hubspot",
      objectType: "emails",
      status: "partial",
      recordsSynced: 3,
      startedAt: daysAgo(0),
      finishedAt: daysAgo(0),
      message: "Mock sync — rate limited, 3 of 5 emails synced",
    },
  ]);

  // ----- Report definition presets -----
  await db.insert(reportDefinitionsTable).values([
    {
      name: "Pipeline by Stage",
      isPreset: true,
      createdById: userByName.get("Shane Mattingly") ?? null,
      spec: {
        sources: ["opportunities"],
        dimensions: ["stageCanonical"],
        metrics: [{ agg: "sum", field: "amount", label: "Pipeline" }],
        filters: [],
        chartType: "bar",
      },
    },
    {
      name: "Pipeline by Source System",
      isPreset: true,
      createdById: userByName.get("Shane Mattingly") ?? null,
      spec: {
        sources: ["opportunities"],
        dimensions: ["sourceSystem"],
        metrics: [{ agg: "sum", field: "amount", label: "Pipeline" }],
        filters: [],
        chartType: "pie",
      },
    },
    {
      name: "Campaign Influenced Pipeline",
      isPreset: true,
      createdById: userByName.get("MaryFran Anderson") ?? null,
      spec: {
        sources: ["campaigns"],
        dimensions: ["channel"],
        metrics: [{ agg: "sum", field: "influencedPipeline", label: "Influenced Pipeline" }],
        filters: [],
        chartType: "bar",
      },
    },
    {
      name: "Open Opportunities by Owner",
      isPreset: true,
      createdById: userByName.get("Quick Chadwick") ?? null,
      spec: {
        sources: ["opportunities"],
        dimensions: ["ownerName"],
        metrics: [{ agg: "count", label: "Open Opps" }],
        filters: [{ field: "stageCanonical", op: "notIn", value: ["Closed Won", "Closed Lost"] }],
        chartType: "bar",
      },
    },
  ]);

  // ----- Internal follow-up tasks linked to CRM records -----
  const sfOpps = insertedOpps.filter((o) => o.sourceSystem === "salesforce");
  const hsOpps = insertedOpps.filter((o) => o.sourceSystem === "hubspot");
  const linkOppA = sfOpps[0]!;
  const linkOppB = hsOpps[0]!;
  const linkCampaign = campaignByName.get("PE Operator Paid Social")!;
  const riverside = accountByName.get("Riverside Hospitality Group")!;
  const harbor = accountByName.get("Harbor Point Capital")!;
  const greenfield = accountByName.get("Greenfield Ventures LLC")!;
  const followUpTasks = await db
    .insert(tasksTable)
    .values([
      {
        projectId: "P3-1",
        assigneeId: userByName.get("Quick Chadwick")!,
        role: "Owner",
        description: `Follow up with ${riverside.name} on franchise agreement`,
        priority: "High",
        status: "In Progress",
        percentComplete: 40,
        startDate: mondayOf(daysAgo(7)),
        dueDate: mondayOf(daysAgo(-7)),
        lastUpdate: "Sent proposal; awaiting signed LOI",
        nextStep: "Confirm financing readiness",
      },
      {
        projectId: "P3-1",
        assigneeId: userByName.get("MaryFran Anderson")!,
        role: "Owner",
        description: `Send discovery deck to ${greenfield.name}`,
        priority: "Medium",
        status: "Not Started",
        percentComplete: 0,
        startDate: mondayOf(daysAgo(-3)),
        dueDate: mondayOf(daysAgo(-14)),
        nextStep: "Tailor deck to multi-unit operator",
      },
      {
        projectId: "P3-1",
        assigneeId: userByName.get("Quick Chadwick")!,
        role: "Owner",
        description: `Manager approval needed: discount terms for ${harbor.name}`,
        priority: "High",
        status: "Blocked",
        percentComplete: 20,
        startDate: mondayOf(daysAgo(4)),
        dueDate: mondayOf(daysAgo(-5)),
        blockedById: userByName.get("Shane Mattingly")!,
        blockNotes: "Pending VP approval on non-standard discount",
        roadblock: "Awaiting manager approval on discount terms",
        nextStep: "Escalate to Shane for sign-off",
      },
    ])
    .returning();

  await db.insert(crmTaskLinksTable).values([
    {
      taskId: followUpTasks[0]!.id,
      sourceSystem: linkOppA.sourceSystem,
      recordType: "opportunity",
      recordId: linkOppA.id,
    },
    {
      taskId: followUpTasks[1]!.id,
      sourceSystem: linkOppB.sourceSystem,
      recordType: "opportunity",
      recordId: linkOppB.id,
    },
    {
      taskId: followUpTasks[2]!.id,
      sourceSystem: linkCampaign.sourceSystem,
      recordType: "campaign",
      recordId: linkCampaign.id,
    },
  ]);

  console.log(
    `Seeded: ${FOCUS_AREAS.length} focus areas, ${USERS.length} users, ${PROJECT_DEFS.length} projects, ${TASK_DEFS.length} tasks, 1 group, ${insertedMetrics.length} metrics with current-week + 5-week history.`,
  );
  console.log(
    `Seeded CRM: 2 connections, ${insertedAccounts.length} accounts, ${PEOPLE_SEEDS.length} people, ${oppRows.length} opportunities, ${insertedCampaigns.length} campaigns, 3 emails, 4 sync events, 4 report presets, ${followUpTasks.length} linked follow-up tasks.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
