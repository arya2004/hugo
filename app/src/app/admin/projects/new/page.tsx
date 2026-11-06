import { RegisterProject } from '../../../../components/project-client';

export default function NewProject() {
  return (
    <>
      <div className="pagehead">
        <span className="eyebrow">ADMIN / NEW PROJECT</span>
        <h1>Start with your repository.</h1>
        <p>Register the repo. Get its funding address. Add funds when you’re ready.</p>
      </div>
      <RegisterProject />
    </>
  );
}
