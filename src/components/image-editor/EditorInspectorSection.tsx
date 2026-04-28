import type { ReactNode } from 'react';

type EditorInspectorSectionProps = {
  title: string;
  children: ReactNode;
};

const EditorInspectorSection = ({ title, children }: EditorInspectorSectionProps) => {
  return (
    <section className="rounded-[16px] border border-[#efeff4] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(17,24,39,0.04)]">
      <h3 className="text-[13px] font-medium text-[#303643]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
};

export default EditorInspectorSection;
