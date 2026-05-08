import { Project, SourceFile } from 'ts-morph';

export function createProject(files: string[]): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
    },
  });

  for (const file of files) {
    project.addSourceFileAtPath(file);
  }

  return project;
}

export function getSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles();
}
