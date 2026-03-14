export interface Template {
  id: string;
  nameKey: string; // i18n key
  content: string;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTemplates(): Template[] {
  const today = todayStr();
  return [
    { id: "blank", nameKey: "template.blank", content: "" },
    {
      id: "meeting",
      nameKey: "template.meeting",
      content: `# Meeting Notes - ${today}\n\n## Attendees\n\n- \n\n## Agenda\n\n1. \n\n## Discussion\n\n\n\n## Action Items\n\n- [ ] \n`,
    },
    {
      id: "todo",
      nameKey: "template.todo",
      content: `# Todo - ${today}\n\n## High Priority\n\n- [ ] \n\n## Normal\n\n- [ ] \n\n## Low Priority\n\n- [ ] \n`,
    },
    {
      id: "journal",
      nameKey: "template.journal",
      content: `# ${today}\n\n## Today\n\n\n\n## Thoughts\n\n\n\n## Tomorrow\n\n- \n`,
    },
    {
      id: "blog",
      nameKey: "template.blog",
      content: `# Title\n\n> Summary\n\n## Introduction\n\n\n\n## Main Content\n\n\n\n## Conclusion\n\n\n\n---\n\n*Tags: *\n`,
    },
  ];
}
