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
      penaltyLevel: "15-30 Days Suspension / Dismissal",
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
  penaltyLevel: "1 to 7 Days Suspension",
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
  penaltyLevel: "1 to 7 Days Suspension",
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
        "2nd offense: 7 days suspension",
        "3rd offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter"
      ],
    },

    {
  section: "Sec. 2",
  violation: "Sleeping During Working Hours",
  description:
    "A. Intently sleeping with the presented proof or incident report from the authority. <br> <br> B. Unintentional naps due to exhaustion with a valid and acceptable reason",
  penaltyLevel: "7–30 Days Suspension",
  severity: "Major",
  penalties: [
      "1st offense: 15 days suspension",
  "2nd offense: 30 days suspension and subject to commitment letter.",
  "", // break line
  "1st offense : Written and Verbal Warning.",
  "2nd Offense: 7 days suspension.",
  "3rd offense: 15 days suspension",
  "4th offense: 30 days suspension and subject to commitment letter",
  ],
},

    {
      section: "Sec. 3",
      violation: "Non-Work-Related Activities During Work Hours",
      description:
        "Spending time on non-work-related matters during working hours that affects productivity (e.g., use of phone or gadgets).",
      penaltyLevel: "15-30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "If gadget use is work-related: With Notice",
      ],
    },
    {
      section: "Sec. 4",
      violation: "Unauthorized Installation or Use of Pirated Software",
      description:
        "Installation, use,operation, and other similar acts and/or unauthorized download of any file of unauthorized, unlicensed, or pirated computer software on the company's computer, laptoop, or other device",
      penaltyLevel: "15-30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: Written and Verbal Warning",
        "2nd offense: 7 days suspension",
        "3d offense: 15 days suspension",
        "4th offense: 30 days suspension and subject to commitment letter",
      ],
    },
    {
      section: "Sec. 5",
      violation: "Unauthorized Removal of Company Property",
      description:
        "Improperly withdrawing or removing company records, equipment,tools, and other asset from the premises without authority",
      penaltyLevel: "15-30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
      ],
    },
     {
      section: "Sec. 6",
      violation: "Unauthorized Activities During Office Hours",
      description:
        "Doing unauthorized undertakings during office hours within the company premises",
      penaltyLevel: "30 Days Suspension / Dismissal",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 7",
      violation: "Unauthorized Meetings or Illegal Assembly During Office Hours",
      description:
        "Holding an unthorized meeting during office time and/or participating in any illegal assembly.",
      penaltyLevel: "30 Days Suspension / Dismissal",
      severity: "Major",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 8",
      violation: "Unauthorized Use of Restricted Equipment",
      description:
        "Use of restricted equipment such as phones and facilities intended for authorized personnel only.",
      penaltyLevel: "7–30 Days Suspension",
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
      penaltyLevel: "30 Days Suspension / Dismissal",
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
        "Being involved in financing, collecting, bookmaking, gambling, lottery, betting, and/or any money-related games within company premises, including the exchange of payments and bets.",
      penaltyLevel: "30 Days Suspension / Dismissal",
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
      penaltyLevel: "30 Days Suspension / Dismissal",
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
      penaltyLevel: "30 Days Suspension / Dismissal",
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
      penaltyLevel: "30 Days Suspension / Dismissal",
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
      penaltyLevel: "30 Days Suspension / Dismissal",
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
    {
      section: "Sec. 21",
      violation: "Coercion, Maltreatment, or Workplace Favoritism",
      description:
        "Coercion, maltreatment or any retaliatory act toward colleagues or other employees, including partiality or favoritism",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 22",
      violation: "Provoking Fight or Unnecessary Dispute",
      description:
        "Provoking any kind of fight or unnecessary dispute with a client, customer, officer, or any employee of the company.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 23",
      violation: "Inciting or Participating in Work Disruption or Collective Conflict",
      description:
        "Inciting, instigating, provoking, or participating in any kind of fight, swarm, or concerted act that woul cause work to slow down.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 24",
      violation: "Threatening Harm to Any Employee",
      description:
        "Threatening any kind of harm or any employee inside or outside the company premises",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 25",
      violation: "Subversive Act, Fighting, or Assault Causing Harm (Inside or Outside Company Premises)",
      description:
        "A subversive act, fighting, or assault committed inside or 1 offense: Dismissal outside of the company premises that resulted in any kind of ham to another person, whether client or co-employee, <br> <br> A. Mental or emotional harm or danage (i.e., major distress) <br> B. Bodily or physical harm. Exemption: a proven self-defense act.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 26",
      violation: "Horseplay, Mischief, or Unsafe Conduct Causing Risk of Injury or Damage",
      description:
        "Engaging in horseplayor malicious mischie, remaining scuffling, or throwing things that may result in the injury of another personand/or the destruction of company property.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 27",
      violation: "Willful Injury or Attempted Injury to Colleague or Client",
      description:
        "Willfully causing injury or deliberation of attempted injury to a colleague or client inside and outside the company premises.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
    {
      section: "Sec. 28",
      violation: "Possession or Attempted Introduction of Weapons or Firearms in Company Premises.",
      description:
        "Carrying. possessing, or attempting to bring any deadly or  prohibited weapons or firearms at any time within the company premises.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal",
      ],
    },
     {
      section: "Sec. 29",
      violation: "Smoking or Bringing Smoking Paraphernalia in Restricted Areas",
      description:
        "Smoking and/or the bringing of any smoking paraphernalia in the restricted areas. <br> <br> A. While on duty in the presence of clients and customers. <br> B. During the company investigation, due to the major restriction on the non-smoking agreement.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
        "1st offense: Dismissal during the company investigation, due to the major restriction on the non-smoking agreement.",
      ],
    },
    {
      section: "Sec. 30",
      violation: "Alcohol Consumption or Intoxication During Work Hours / Within Company Premises",
      description:
        "Drinking any alcoholic beverages during office hours or within the company premises. <br> <br> A. Reporting to work or performing duties under the influence of alcohol <br> <br> Exemption: authorized gatherings and occasional drinking during non-working days or hours.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension",
        "2nd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 31",
      violation: "Dangerous Drugs Act Violation",
      description:
        "This violation refers to any involvement with illegal or prohibited drugs as defined under applicable laws and company policy. It covers activities related to selling, possession, use, or confirmed drug use status that affect workplace safety, discipline, and compliance. <br> <br> A. Selling of prohibited drugs to employees or clients <br> <br> B. Possession and/or use inside and outside the company premises <br> <br> C. Being proven as a dangerous drug user (i.e. positive drug test)",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal", 
      ],
    },
    {
      section: "Sec. 32",
      violation: "Scandalous or Improper Workplace Relationships",
      description:
        "Engaging in scandalous relationships, such as maintaining a relationship with another employee when in a valid marriage and'or common-law relationship.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal", 
      ],
    },
     {
      section: "Sec. 33",
      violation: "Immoral Conduct and Lascivious Acts in Scandalous Circumstances",
      description:
        "Immoral conduct, such as exhibitionism or the distribution of pornographic literature, or acts of lasciviousness under scandalous circumstances.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal", 
      ],
    },
    {
      section: "Sec. 34",
      violation: "Commission of a Crime Involving Moral Turpitude",
      description:
        "Commission of a crime involving mortal turpitude such as seduction, rape, abduction, and acts of lasciviousness.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal", 
      ],
    },
    {
      section: "Sec. 35",
      violation: "Commission of a Crime Punishable by Imprisonment",
      description:
        "Commission of a crime where the penalty imposed is imprisonment. <br> <br> A. Being suspect with enough and acceptable evidence. <br> B.Not being the instigator but having commited a crime for self-defense acts. <br> C.Being part of or involved with the crime happened. <br> <br> Excemption: Being proven not guilty <br> <br> Condition: Shouldering all the expenses of the damages done.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: Dismissal", 
        "1st offense: 30 days suspension and the employee will shoulder all the charges that may apply according to the case",
        "2nd offense: Dismissal",
        "1st offense: 30 days suspension and the employee will shoulder all the charges that may apply according to the case",
        "2nd offense: Dismissal",
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
      penaltyLevel: "7–30 Days Suspension",
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
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
        "4th offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Failure to Comply With Instructions Causing Damage or Claims",
      description:
        "Failure or refusal to comply with verbal or written instructions from superiors resulting in damage, loss, and claims on company-owned and controlled property. A cost will be charged to the employee aside from disciplinary action.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
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
      penaltyLevel: "7–30 Days Suspension / Dismissal / RTA",
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
      penaltyLevel: "7–30 Days Suspension / Dismissal / RTA",
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
      penaltyLevel: "15-30 Days Suspension / Dismissal",
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
      penaltyLevel: "15-30 Days Suspension / Dismissal",
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
      violation: "Improper Storage of Company Equipment or Property",
      description:
        "Storage of the equipment or any comnpany property in an inaccurate designated area causes delays in transactions and violations of safekeeping",
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
      violation: "Failure to Report Loss of Company Property, Incidents, or Injuries",
      description:
        "Failing to report loss of company property as early as the employee is already aware of the incident and/or failing report any accident or injury that happened to any employee",
      penaltyLevel: "15-30 Days Suspension / Dismissal",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension",
        "3rd offense: Dismissal",
        
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
        "Neglect of duty that causes considerable conflict, damage or loss of company equipment or property",
      penaltyLevel: "15-30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
        "4th offense: Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation:
        "Neglect of Duty Resulting in Fine, Penalty, or Dangerous Incident",
      description:
        "Neglect of duty that results in a fine, penalty, major circumstance, or dangerous incident affecting operations.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "Minor instance: 15 days suspension",
        "Major/dangerous incident: 30 days suspension and subject to commitment letter",
        "Next offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Gross Negligence of Duty Affecting Equipment and Personnel Safety",
      description:
        "Gross negligence of duty, which endangered the efficiency of  the equipment and machinery. The same as causing hazardous risk to personnel safety. <br> <br> Charges for all the costs will be penalized to the employee commitment letter aside from undertaking disciplinary action.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 8",
      violation: "Unjustifiable Errors in Client Service Delivery",
      description:
        "Unjustifiable mistakes and errors in catering to the client's transaction, services, or needs resulted in their dissatisfaction.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 9",
      violation: "Provision of False, Inaccurate, Misleading, or Withheld Information",
      description:
        "Giving false,inaccurate,misleading,incomplete, delayed, or a total lack of information to the under-employees,collegues,clients,superiors, or any company personnel. Wherein he/she is accountable for aquisition and keeping such informationthat leads to inconvinenience to the client and company management.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 10",
      violation: "Failure to Properly Cater to Client Needs and Requests",
      description:
        "Being unable to properly cater to the client's needs and requests without justifiable reason.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 11",
      violation: "Failure to Exercise Required Diligence Resulting in Risk Exposure",
      description:
        "Failure to observe the degree of diligence demanded by the situation exposed the client, customers, or company management to unnecessary risks.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 12",
      violation: "Other Acts Leading to Gross Negligence of Duty",
      description:
        "Committing other actions that lead to gross negligence of duty",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 13",
      violation: "Other Acts Leading to Gross Negligence of Duty",
      description:
        "Being graded below average in the performance appraisal two or more times, which leads to a lack of improvement regardless of the guidance and proper instruction of the immediate superior",
      penaltyLevel: "Re-assignment or Dismissal / RTA",
      severity: "Major",
      penalties: [
       "Re-assignment/Dismissal",
      ],
    },
  ],
},
{
  category: "V. BETRAYAL OF TRUST / DISHONESTY",
  rows: [
    {
      section: "Sec. 1",
      violation: "Unauthorized Use or Handling of Company or Others’ Property/Tools",
      description:
        "Processing, obtaining, or using other people's property or tools without prior consent or authorization within the company's premises",
      penaltyLevel: "7–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Malicious Destruction, Defacement, or Damage of Property",
      description:
        "Maliciously and intentionally destroying, defacing, or damaging the properties of the company, employees, officials, or clients.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Stealing Company Assets or Personal Property",
      description:
        "Stealing or attempting to steal any company assets from the company premises or from any personnel within the corporate area",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Improper Involvement with Company Funds",
      description:
        "Involvement with the impropriety of the company's funds.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Unauthorized or Reckless Use of Company Property and Vehicles",
      description:
        "Unauthorized or reckless use of company property and vehicles",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Unauthorized Removal of Company Records or Property",
      description:
        "Unauthorized removal of any company records or property from its premises.",
      penaltyLevel: "7–30 Days Suspension",
      severity: "Major",
      penalties: [
        "1st offense: 7 days suspension",
        "2nd offense: 15 days suspension ",
        "3rd offense: 30 days suspension and subject to commitment letter",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Substituting or Altering Company Materials for Personal Gain",
      description:
        "Substituting and changing company materials for self-gain intentions",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
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
        "Dismissal",
      ],
    },
    {
      section: "Sec. 9",
      violation: "Unauthorized Disclosure or Conspiracy Involving Company Property for Personal Gain",
      description:
        "Invading, divulging, or conspiring with any company property for personal gain",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },
   {
      section: "Sec. 10",
      violation: "Encouraging or Tolerating Violations of Company Rules and Regulations",
      description:
        "Encouraging, coercing, inciting, bribing, directing, or tolerating any employee or service provider to violatetheimplemented rules and regulations",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
     {
      section: "Sec. 11",
      violation: "Deliberate Sabotage, Espionage, or Unauthorized Use of Company Property or Intellectual Property",
      description:
        "Deliberate sabotage and espionage of the company property,use of the company name, or any intellectual property for pecuniary gain",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 12",
      violation: "Unauthorized Solicitation, Selling, or Collection Activities Within Company Premises",
      description:
        "Indulging usury, collecting monetary contributions, soliciting,vending, peddling, or selling any kind of goods or services from anyone within the company from the management",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 13",
      violation: "Tampering or Falsification of Personal Records",
      description:
        "Tampering or falsifying personal records either during the application and/or employment",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },
    {
      section: "Sec. 14",
      violation: "Tampering with Company Documents and Records",
      description:
        "Tampering of company-released or well-kept documents suchas invoices, reimbursements, records, etc.",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 15",
      violation: "Deception or Manipulation of Employees for Personal Gain",
      description:
        "Any form of deception done to another employee that causes manipulation for personal gain or defrauding purposes",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
     {
      section: "Sec. 16",
      violation: "Unauthorized Personal Exchange of Cash, Bank Funds, Checks, or E-Money",
      description:
        "Unauthorized cash, bank money, check, or e-money personal exchange, which caused unnecessary conflict with the operational procedures.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    }, 
    {
      section: "Sec. 17",
      violation: "Involvement in Anomalous or Irregular Transactions",
      description:
        "Engaging in and being involved in anomalous transactions",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },
    {
      section: "Sec. 18",
      violation: "Bribery in Exchange for Employment or Workplace Benefits",
      description:
        "Offering or receiving money or other valuable consideration in exchange for a job, working conditions",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },
    {
      section: "Sec. 19",
      violation: "Theft or Robbery of Personal, Company, or Client Property",
      description:
        "Theft or robbery of the personal stuff, salary, fund, or any property of the company, colleague, and/or client",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal and paying 10x the amount robbed.",
      ],
    },
    {
      section: "Sec. 20",
      violation: "Unauthorized Disclosure of Confidential Company Information",
      description:
        "Unauthorized disclosure of all the existing and upcoming information, issues, ideas, strategies, etc. from the company",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },  
    {
      section: "Sec. 21",
      violation: "Refusal or False Statements During Company Investigation or Proceedings",
      description:
        "Refusing to provide or providing false statements during a company investigation, administrative hearing, counseling, or consultation with any authorized personnel",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension and subject to commitment letter",
        "2nd offense: Dismissal",
      ],
    },
    {
      section: "Sec. 22",
      violation: "Unauthorized Wiretapping or Recording During Company Proceedings",
      description:
        "Unauthorized wire tapping during a company investigation,administrative hearing, counseling, or consultation with any authorized personnel",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },   
    {
      section: "Sec. 23",
      violation: "Falsification of Company Documents, Records, or Information",
      description:
        "Falsification of any document, record, and other information from and for the company during inquiry, research investigation, or any transactions in the company",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 24",
      violation: "Accepting or Owing Improper Benefits from Affiliated Individuals or Organizations",
      description:
        "Owing or accepting money, gifts, commissions, or other offers from any one or any organization affiliated with the company for one's own benefit",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 25",
      violation: "Unauthorized Engagement in Business Transactions with Competitors for Personal Gain",
      description:
        "Unauthorized engagement in any business transactions with any competitors for personal gain",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    },
    {
      section: "Sec. 26",
      violation: "Unauthorized Business Arrangements with Clients or Suppliers Involving Preferential Treatment or Commissions",
      description:
        "Being involved in unauthorized business arrangements with any client or supplier that involve any preferential treatment or commissions",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 27",
      violation: "Misuse of Company Time or Property for Unauthorized Business Activities",
      description:
        "Allocating company time or any company property for any unauthorized business",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension and subject to commitment letter",
        "2nd offense: Dismissal",
      ],
    }, 
    {
      section: "Sec. 28",
      violation: "Creation or Submission of Anomalous or Fraudulent Reports",
      description:
        "Creation and/or submission of anomalous or fraudulent reports",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
      ],
    }, 
    {
      section: "Sec. 29",
      violation: "Conflict of Interest and/or Betrayal of Trust",
      description:
        "Any act that falls under Conflict of Interest and/or Betrayal of Trust",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
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
      penaltyLevel: "15-30 Days Suspension / Dismissal",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 2",
      violation: "Failure or Refusal to Cooperate with Security Protocols",
      description:
        "Failure or refusal to cooperate with security protocol enforced by the authorized security system",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 3",
      violation: "Refusal to Undergo Required Annual Physical Examination",
      description:
        "Refusal to abide by the order to undergo an annual physical exam or check-up within the prescribed period",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 4",
      violation: "Failure to Report Health Conditions",
      description:
        "Failure to report any transmittable or contagious health condition that may endanger another employee.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension and subject to commitment letter",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 5",
      violation: "Failure to Report Contagious or Transmittable Health Condition of a Co-Employee",
      description:
        "Failure to report a fellow who is infected with a transmittable or contagious health condition that may endanger another employee",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 6",
      violation: "Failure to Report Contagious or Transmittable Health Conditions",
      description:
        "Any opposing act on proper sanitation, such as spitting,urinating, and littering in an unauthorized or inappropriatearea <br> <br>On a case-by-case basis, if the client company is very sensitive to the rule mentioned, the decision can lead dismissal.",
      penaltyLevel: "30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "1st offense: 30 days suspension and subject to commitment letter",
        "2nd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 7",
      violation: "Failure or Refusal to Wear PPE",
      description:
        "Failing or refusing to wear Personal Protective Equipment (PPE) or required safety gear.",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
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
      violation: "Poor Housekeeping and Sanitation Non-Compliance",
      description:
        "Being involved in poor housekeeping and sanitation defiance",
      penaltyLevel: "15 to 30 Days Suspension / Dismissal / RTA",
      severity: "Major",
      penalties: [
        "1st offense: 15 days suspension",
        "2nd offense: 30 days suspension and subject to commitment letter",
        "3rd offense: Dismissal",
      ],
    },

    {
      section: "Sec. 9",
      violation: "Failure, Refusal, or Falsification of Required Medical and Physical Examinations",
      description:
        "Failure, refusal, and/or submission of falsified medical and physical examinations as a requirement from the company",
      penaltyLevel: "Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "Dismissal",
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
      penaltyLevel: "15-30 Days Suspension / Dismissal / RTA",
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
      penaltyLevel: "15-30 Days Suspension / Dismissal / RTA",
      severity: "Critical",
      penalties: [
        "15-30 Days Suspension / Dismissal / RTA",
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