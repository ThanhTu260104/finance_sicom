import { ProjectForm } from '@/components/projects/project-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export default function NewProjectPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Dự án', href: '/projects' },
          { label: 'Thêm dự án' },
        ]}
      />
      <h2 className="font-serif text-2xl font-semibold">Thêm dự án</h2>
      <ProjectForm />
    </div>
  );
}
