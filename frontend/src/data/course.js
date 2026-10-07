export const modules = [
  "Welcome to tree stewardship",
  "Tree identification",
  "Getting to know your soil",
  "Choosing the right tree",
  "Planting with purpose",
  "Water-wise care",
  "Capturing rainwater",
  "Mulch and healthy roots",
  "Pruning fundamentals",
  "Recognizing tree stress",
  "Trees and community",
  "Your stewardship journey",
].map((title, index) => ({ id: index + 1, title }));

export const initialBlocks = [
  {
    id: "quiz-2",
    moduleId: 2,
    type: "Quiz",
    title: "Native species ID quiz",
    description:
      "Review the identifying features of trees in our desert landscape.",
    published: true,
    detail: "Sample quiz · Questions are not available yet",
  },
  {
    id: "announcement-2",
    moduleId: 2,
    type: "Announcement",
    title: "Field day moved to Saturday",
    description:
      "Our next tree identification walk will meet at the arboretum gate. This is a sample announcement; confirm actual dates with your instructor.",
    published: true,
  },
  {
    id: "assignment-2",
    moduleId: 2,
    type: "Assignment",
    title: "Tree health assessment report",
    description:
      "Choose a tree in your neighborhood. Record what you notice about its leaves, trunk, and surrounding soil. Bring your observations and questions to class.",
    published: true,
    detail: "Sample assignment · No due date set",
  },
  {
    id: "announcement-1",
    moduleId: 1,
    type: "Announcement",
    title: "A warm welcome to the program",
    description:
      "Over twelve weeks, explore how to care for trees and the communities around them. These sample materials demonstrate the layout while our instructors prepare the curriculum.",
    published: true,
  },
];
