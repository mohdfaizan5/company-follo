import type { JSONContent } from '@tiptap/react'

export type DocTemplate = { id: string; title: string; kind: 'policy' | 'sop' | 'guide'; icon: 'calendar' | 'user-plus' | 'receipt' | 'shield'; content: JSONContent }

const text = (value: string): JSONContent => ({ type: 'text', text: value })
const heading = (value: string, level = 2): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const paragraph = (value: string): JSONContent => ({ type: 'paragraph', content: [text(value)] })
const bullets = (items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })) })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

/** Starter documents offered on the empty Docs page. Each one opens in the editor ready to adapt. */
export const docTemplates: DocTemplate[] = [
  {
    id: 'leave-policy', title: 'Leave policy', kind: 'policy', icon: 'calendar',
    content: doc(
      heading('Leave policy', 1),
      paragraph('This policy explains how time off works at our company: how much you get, how to ask for it and who approves it.'),
      heading('Annual leave'),
      bullets(['Every full-time team member gets [number] days of paid leave per year.', 'Leave builds up monthly and part of it can carry into the next year.', 'Half-days are allowed unless a manager says otherwise for a project.']),
      heading('Sick and other leave'),
      bullets(['Tell your manager as early as you can if you are unwell.', 'Add any other kinds of leave we offer, such as parental or bereavement leave.']),
      heading('How to request leave'),
      paragraph('Ask HR to record your leave with the dates and a short reason. You will hear back once your manager has approved it.'),
    ),
  },
  {
    id: 'employee-onboarding', title: 'Employee onboarding', kind: 'guide', icon: 'user-plus',
    content: doc(
      heading('Employee onboarding', 1),
      paragraph('A checklist to help every new joiner feel settled in their first weeks.'),
      heading('Before day one'),
      bullets(['Send the invitation so they can sign in.', 'Prepare their equipment and accounts.', 'Tell the team who is joining and when.']),
      heading('First week'),
      bullets(['Welcome meeting with their manager.', 'Introductions to the people they will work with.', 'Walk through our policies and this handbook.']),
      heading('First 30 days'),
      bullets(['Agree on goals for the first quarter.', 'Check in weekly and ask for honest feedback on onboarding.']),
    ),
  },
  {
    id: 'expense-policy', title: 'Expense policy', kind: 'policy', icon: 'receipt',
    content: doc(
      heading('Expense policy', 1),
      paragraph('How to spend company money responsibly and get paid back for work expenses.'),
      heading('What we cover'),
      bullets(['Travel, lodging and meals while working away from home.', 'Software and equipment approved by your manager.', 'Learning and conference costs agreed in advance.']),
      heading('How to claim'),
      bullets(['Keep every receipt.', 'Submit your expense within [number] days.', 'Include what it was for and who it helped.']),
      heading('Approval limits'),
      paragraph('List who approves what, for example managers up to [amount] and the owner above that.'),
    ),
  },
  {
    id: 'code-of-conduct', title: 'Code of conduct', kind: 'policy', icon: 'shield',
    content: doc(
      heading('Code of conduct', 1),
      paragraph('How we treat each other, our customers and our work.'),
      heading('Our values'),
      bullets(['Be respectful and assume good intent.', 'Be honest, including when it is uncomfortable.', 'Take ownership and help others succeed.']),
      heading('What we do not accept'),
      bullets(['Harassment or discrimination of any kind.', 'Sharing confidential company or customer information.', 'Conflicts of interest that are not disclosed.']),
      heading('Raising a concern'),
      paragraph('Speak to your manager or HR. Concerns are handled in confidence and no one is penalised for raising them in good faith.'),
    ),
  },
]
