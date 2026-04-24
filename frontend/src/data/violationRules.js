export const VIOLATION_RULES = [
  {
    category: "I. ABSENCES AND TARDINESS",
    rows: [
   {
  section: "Sec. 1",
  violation: "Absence Without Official Leave (Single Absence)",
  description:
    "Absence without permission, written authorization, and/or official leave for a <strong>day</strong>.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    {
      offenseNo: 1,
      label: "1st offense",
      action: "Written and Verbal Warning",
    },
    {
      offenseNo: 2,
      label: "2nd offense",
      action: "1 day suspension",
    },
    {
      offenseNo: 3,
      label: "3rd offense",
      action: "3 days suspension",
    },
    {
      offenseNo: 4,
      label: "4th offense",
      action: "5 days suspension and subject to commitment letter",
    },
  ],
},

{
  section: "Sec. 2",
  violation: "Absence Without Official Leave (Excessive Absences)",
  description:
    "Absence without permission, written authorization, and/or official leave for at least <strong>two consecutive days</strong>.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    {
      offenseNo: 1,
      label: "1st offense",
      action: "Written and Verbal Warning",
    },
    {
      offenseNo: 2,
      label: "2nd offense",
      action: "1 day suspension",
    },
    {
      offenseNo: 3,
      label: "3rd offense",
      action:
        "3 days suspension or equivalent number of suspensions from absences",
    },
    {
      offenseNo: 4,
      label: "4th offense",
      action: "5 days suspension and subject to commitment letter",
    },
  ],
},
    {
      section: "Sec. 3",
      violation: "Abandonment of Duty",
      description:
        "Unauthorized absence of <strong>5 or more consecutive working days</strong>.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Equivalent number of suspensions based on absences",
        "2nd offense: 15 days suspension and subject to commitment letter",
        "3rd offense: Subject to RTA",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Extending Authorized Leave Without Approval (Over-leave)",
      description:
        "Extending a previously authorized leave of absence without prior authorization from any superior.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Equivalent number of suspensions based on unauthorized absences",
        "2nd offense: 15 days suspension and subject to commitment letter",
        "3rd offense: Subject to RTA / Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Failure to Notify Absence",
      description:
        "Failure to notify the office of an absence due to sickness or emergency leave.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 1 day suspension",
        "3rd offense: 3 days suspension",
        "4th offense: 5 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Failure to Submit Valid Proof of Absence",
      description:
        "Failure to submit valid and/or authenticated evidence for absence (e.g., medical certificate, documents, images, or videos).",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 1 day suspension",
        "3rd offense: 3 days suspension",
        "4th offense: 5 days suspension and subject to commitment letter",
      ],
    },

    {
  section: "Sec. 7",
  violation: "Unexcused Tardiness",
  description:
    "Any of the following is considered an offense: <br/>A. Accumulation of tardiness for a total of 60 minutes within a payroll period (15-day period) <br/>B. 1 time late of 30 minutes in a payroll period <br/>C. 3 times late of 10 minutes or more in a payroll period <br/>D. 4 times late of 5 minutes or more in a payroll period",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    "1st offense: Verbal Warning",
    "2nd offense: Written Warning",
    "3rd offense: 1 day suspension",
    "4th offense: 3 days suspension or equivalent number of suspensions from habitual tardiness",
    "5th offense: 5 days suspension or equivalent number of suspensions from habitual tardiness and subject to commitment letter",
      ],
    },
    {
  section: "Sec. 8",
  violation: "Unauthorized Undertime and Quitting Before End of Working Hours",
  description:
    "Unauthorized undertime and quitting before the end of working hours.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    "1st offense: Written and Verbal Warning",
    "2nd offense: 1 day suspension",
    "3rd offense: 3 days suspension",
    "4th offense: 5 days suspension and subject to commitment letter",
  ],
},

{
  section: "Sec. 9",
  violation: "Undertime Without Written Authorization",
  description:
    "Undertime without written authorization means quitting or leaving the workplace for two hours or less before the official time off.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    "1st offense: Written and Verbal Warning",
    "2nd offense: 1 day suspension",
    "3rd offense: 3 days suspension",
    "4th offense: 5 days suspension and subject to commitment letter",
  ],
},

{
  section: "Sec. 10",
  violation: "Violation of Break Time and Lunch Schedule",
  description:
    "Violation of break time and lunch schedule, such as exceeding time or having unauthorized break times.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    "1st offense: Written and Verbal Warning",
    "2nd offense: 1 day suspension",
    "3rd offense: 3 days suspension",
    "4th offense: 5 days suspension and subject to commitment letter",
  ],
},

{
  section: "Sec. 11",
  violation: "Failure to Record Attendance",
  description:
    "Failure to write in the log book, punch in a time card/swipe ID/DTR, or register in the biometric attendance system.",
  penaltyLevel: "Warning / 1–7 Days Suspension",
  severity: "Minor",
  penalties: [
    "1st offense: Written and Verbal Warning",
    "2nd offense: 1 day suspension",
    "3rd offense: 3 days suspension",
    "4th offense: 5 days suspension and subject to commitment letter",
  ],
},

{
  section: "Sec. 12",
  violation: "Punching or Logging Attendance for Another Employee",
  description:
    "Intently punching in the time card or logging in attendance for another employee.",
  penaltyLevel: "1–7 Days Suspension",
  severity: "Major",
  penalties: [
    "1st offense: 3 days suspension",
    "2nd offense: 5 days suspension",
    "3rd offense: 7 days suspension and subject to commitment letter",
  ],
},

{
  section: "Sec. 13",
  violation: "Unauthorized Time Card or ID Alteration",
  description:
    "Unauthorized alteration, concealment, removal, and/or destruction made on one’s time card/ID.",
  penaltyLevel: "1–7 Days Suspension",
  severity: "Major",
  penalties: [
    "1st offense: 3 days suspension",
    "2nd offense: 5 days suspension",
    "3rd offense: 7 days suspension and subject to commitment letter",
  ],
},
    ]
  },
  {
  category: "II. DISORDERLY CONDUCT AND MISBEHAVIOR",
  rows: [
    {
      section: "Sec. 1",
      violation: "Loitering During Working Hours",
      description:
        "Loitering inside and outside the company premises during working hours.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Sleeping During Working Hours",
      description:
        "Sleeping during working hours, whether intentional with proof or unintentional due to exhaustion.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension or Written and Verbal Warning (depending on case)",
        "2nd offense: 30 days suspension or 7 days suspension (depending on case)",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Non-Work-Related Activities During Work Hours",
      description:
        "Spending time on non-work-related matters during working hours that affects productivity (e.g., use of phone or gadgets).",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "If gadget use is work-related: With Notice",
      ],
    },

    {
      section: "Sec. 8",
      violation: "Unauthorized Use of Restricted Equipment",
      description:
        "Use of restricted equipment such as phones and facilities intended for authorized personnel only.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 7 days suspension",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 9",
      violation: "Unauthorized Entry to Restricted Areas",
      description:
        "Intently entering and/or letting someone enter restricted areas without authorization.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 10",
      violation: "Involvement in Gambling or Betting",
      description:
        "Being involved in financing, collecting, bookmaking, gambling, lottery, betting, and/or any money-related games within company premises.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 11",
      violation: "Damaging Company Property",
      description:
        "Willfully misusing, destroying, defacing, or damaging company tools, equipment, and/or vehicles.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 12",
      violation: "Unauthorized Disposal or Taking of Company Items",
      description:
        "Wasteful usage, disposal, or bringing home office supplies, stocks, or client items without accountability.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 13",
      violation: "Unauthorized Distribution of Materials",
      description:
        "Distributing unauthorized written or printed materials within company premises.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 14",
      violation: "Unauthorized Alteration of Company Property",
      description:
        "Defacing, removing, tearing, mutilating, or altering company assets, documents, or posted announcements.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 15",
      violation: "Unauthorized Posting of Notices",
      description:
        "Posting unnecessary or unauthorized notices, announcements, or materials within company premises.",
      penaltyLevel: "30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 16",
      violation: "Failure to Report Lost and Found Items",
      description:
        "Failure to report or turnover lost and found items according to company procedures.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 17",
      violation: "Bringing Unauthorized Personal Belongings",
      description:
        "Bringing unauthorized personal belongings into the workplace.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 18",
      violation: "Discourteous Behavior Toward Personnel",
      description:
        "Showing discourteousness or misdeeds toward company officers, supervisors, clients, or personnel.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 19",
      violation: "Use of Profane or Abusive Language",
      description:
        "Using profanities or indecent language, including abusive or derogatory words toward another person.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 20",
      violation: "Libelous Statements or Publications",
      description:
        "Making libelous utterances or publishing statements that dishonor or embarrass a client, employee, or company.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
  ],
},
{
  category: "III. INSUBORDINATION / DISOBEDIENCE",
  rows: [
    {
      section: "Sec. 1",
      violation: "Reporting for Work Without Proper Grooming / Hygiene",
      description:
        "Reporting for work without proper grooming / hygiene.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 3 days suspension",
        "3rd offense: 5 days suspension",
        "4th offense: 7 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Reporting for Work Not in Prescribed Uniform",
      description:
        "Reporting for work not in the prescribed uniform or non-wearing of the prescribed attire for employees who are not required to wear the company uniform.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 3 days suspension",
        "3rd offense: 5 days suspension",
        "4th offense: 7 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Failure or Refusal to Wear ID Card",
      description:
        "Failure or refusal to wear the ID card upon entering and while inside the office premises, or unauthorized and improper use of the company ID card.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 3 days suspension",
        "3rd offense: 5 days suspension",
        "4th offense: 7 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Failure to Cooperate With Other Employees",
      description:
        "Failure to cooperate with other employees regarding duties and responsibilities that can disrupt or affect the smooth operations of the business.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 7 days suspension",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Refusal to Abide by Auditing, Security, and Safety Regulations",
      description:
        "Refusal to abide by the auditing, security, and safety regulations in the performance of official work or in the use of company facilities.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Failure to Comply With Instructions Causing Damage or Claims",
      description:
        "Failure or refusal to comply with verbal or written instructions from superiors resulting in damage, loss, and claims on company-owned and controlled property. A cost will be charged to the employee aside from disciplinary action.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Willful Failure to Carry Out Job Instructions",
      description:
        "Willfully failing to carry out verbal or written job instructions, policies, procedures, or standard operating procedures issued by the immediate superior or any senior officer.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
        "4th offense: Dismissal",
      ],
    },

    {
      section: "Sec. 8",
      violation: "Disobeying Memorandum, Safety Rules, Office Regulation, or Signed Policy",
      description:
        "Disregarding or disobeying any currently implemented memorandum order, safety rules, office regulation, or signed policy.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
        "4th offense: Dismissal",
      ],
    },

    {
      section: "Sec. 9",
      violation: "Gross Insubordination",
      description:
        "Willfully defying or disregarding corporation authority, which falls under gross insubordination.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 10",
      violation: "Refusal to Accept Work, Change of Shift, or Work Location",
      description:
        "Willfully refusing to accept work, a change of shift, or work locations assigned by a superior or Lead Operations.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 11",
      violation: "Refusal to Cooperate in Case Investigation",
      description:
        "Refusing to cooperate in giving valuable information involving a case under investigation.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 12",
      violation: "Other Acts of Insubordination",
      description:
        "Other acts of insubordination occur when there is an overt act that clearly shows disrespect, disobedience, or being an opponent to supervisors or officers.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
  ],
},
{
  category: "IV. NEGLECT OF DUTY",
  rows: [
    {
      section: "Sec. 1",
      violation: "Failure to Perform Duties and Responsibilities",
      description:
        "Failure to perform assigned duties and responsibilities resulting in inefficiency or disruption of operations.",
      penaltyLevel: "Warning / 1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 3 days suspension",
        "3rd offense: 5 days suspension",
        "4th offense: 7 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Carelessness in Performing Duties",
      description:
        "Carelessness or negligence in performing duties that may affect work quality or productivity.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 7 days suspension",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Neglect of Duty Resulting in Injury",
      description:
        "Neglect of duty resulting in injury to any employee within the company.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Neglect of Duty Causing Damage to Company Property",
      description:
        "Neglect of duty that results in damage to company property, equipment, or assets.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation:
        "Neglect of Duty Resulting in Fine, Penalty, or Dangerous Incident",
      description:
        "Neglect of duty that results in a fine, penalty, major circumstance, or dangerous incident affecting operations.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Minor instance: 15 days suspension",
        "Major/dangerous incident: 30 days suspension and subject to commitment letter",
        "Next offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Failure to Report Incidents or Irregularities",
      description:
        "Failure to report incidents, irregularities, or unsafe conditions that may affect operations or employee safety.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Failure to Follow Safety Procedures",
      description:
        "Failure to follow established safety procedures resulting in risk or hazard to employees or operations.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
      ],
    },
  ],
},
{
  category: "V. BETRAYAL OF TRUST / DISHONESTY",
  rows: [
    {
      section: "Sec. 1",
      violation: "Falsification of Documents",
      description:
        "Falsifying company documents, records, or any official forms for personal gain or to mislead the company.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Misrepresentation of Information",
      description:
        "Providing false or misleading information related to employment, records, or company transactions.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Stealing Company Assets or Personal Property",
      description:
        "Stealing or attempting to steal company assets or personal property within company premises.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Unauthorized Possession of Company Property",
      description:
        "Possessing company property without proper authorization or intent to misuse.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Theft or Attempted Theft",
      description:
        "Committing or attempting to commit theft of any company or employee property.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Fraudulent Acts",
      description:
        "Engaging in fraudulent activities or schemes that result in financial or operational loss to the company.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Unauthorized Disclosure of Confidential Information",
      description:
        "Revealing confidential company or client information without authorization.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 8",
      violation: "Defrauding",
      description:
        "Selling company materials or property for self-gain or personal benefit.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 24",
      violation: "Accepting Money, Gifts, or Commissions",
      description:
        "Owing or accepting money, gifts, commissions, or other offers for personal benefit.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
  ],
},
{
  category: "VI. HEALTH, SAFETY, SECURITY, AND SANITATION",
  rows: [
    {
      section: "Sec. 1",
      violation: "Violation of Safety Rules and Regulations",
      description:
        "Violation of safety rules and regulations imposed by the company, management, or authorized department.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Failure to Report Unsafe Conditions",
      description:
        "Failure to report unsafe conditions, hazards, or incidents that may endanger employees or company operations.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Unauthorized Use of Safety Equipment",
      description:
        "Improper or unauthorized use of safety equipment, tools, or devices provided by the company.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 7 days suspension",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Tampering with Safety Devices",
      description:
        "Tampering with, disabling, or damaging safety devices or equipment.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Creating Unsafe or Hazardous Conditions",
      description:
        "Creating or contributing to unsafe or hazardous working conditions that may result in accidents or injuries.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Unauthorized Entry to Restricted or Hazardous Areas",
      description:
        "Entering restricted or hazardous areas without proper authorization.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Failure or Refusal to Wear PPE",
      description:
        "Failing or refusing to wear Personal Protective Equipment (PPE) or required safety gear.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Critical",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
        "4th offense: Dismissal",
      ],
    },

    {
      section: "Sec. 8",
      violation: "Violation of Security Procedures",
      description:
        "Violation of established security procedures that protect company property, personnel, and operations.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 9",
      violation: "Possession of Dangerous or Prohibited Items",
      description:
        "Possession of dangerous, illegal, or prohibited items within company premises.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },

    {
      section: "Sec. 10",
      violation: "Smoking in Non-Designated Areas",
      description:
        "Smoking in areas not designated for smoking within company premises.",
      penaltyLevel: "1–7 Days Suspension",
      severity: "Minor",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 3 days suspension",
        "3rd offense: 5 days suspension",
        "4th offense: 7 days suspension and subject to commitment letter",
      ],
    },
  ],
},
{
  category: "VII. SEXUAL HARASSMENT",
  rows: [
    {
      section: "Sec. 1-5",
      violation: "Sexual Harassment",
      description:
        "Any act of demanding, requesting, or requiring sexual favor, or engaging in conduct that creates an intimidating, hostile, or offensive working environment.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
  ],
},
{
  category: "VIII. HABITUAL VIOLATIONS",
  rows: [
    {
      section: "Sec. 1",
      violation: "Repeated Same Violation (More than Three Times)",
      description:
        "Employee has committed the same violation more than three times despite warnings or suspensions.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Critical",
      penalties: [
        "15 days suspension",
        "If commitment letter is already involved, decision may lead to dismissal",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Multiple Different Violations",
      description:
        "Employee has committed more than two different violations within a given period.",
      penaltyLevel: "15–30 Days Suspension",
      severity: "Critical",
      penalties: [
        "15–30 days suspension",
        "May lead to dismissal depending on the severity of combined violations",
      ],
    },
  ],
}

];

const getOrdinalLabel = (number) => {
  if (number === 1) return "1st offense";
  if (number === 2) return "2nd offense";
  if (number === 3) return "3rd offense";
  return `${number}th offense`;
};

const normalizePenalty = (penalty, index) => {
  if (typeof penalty === "object" && penalty !== null) {
    return penalty;
  }

  if (typeof penalty !== "string") {
    return {
      offenseNo: index + 1,
      label: getOrdinalLabel(index + 1),
      action: "No penalty specified",
    };
  }

  const offenseMatch = penalty.match(/^(\d+(st|nd|rd|th)\s+offense):\s*(.+)$/i);

  if (offenseMatch) {
    return {
      offenseNo: index + 1,
      label: offenseMatch[1],
      action: offenseMatch[3],
    };
  }

  const splitIndex = penalty.indexOf(":");

  if (splitIndex !== -1) {
    return {
      offenseNo: index + 1,
      label: penalty.slice(0, splitIndex).trim(),
      action: penalty.slice(splitIndex + 1).trim(),
    };
  }

  return {
    offenseNo: index + 1,
    label: getOrdinalLabel(index + 1),
    action: penalty,
  };
};

export const NORMALIZED_VIOLATION_RULES = VIOLATION_RULES.map((category) => ({
  ...category,
  rows: category.rows.map((row) => ({
    ...row,
    penalties: row.penalties.map(normalizePenalty),
  })),
}));