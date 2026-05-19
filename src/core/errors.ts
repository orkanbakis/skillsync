export class SkillSyncError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message: string) {
    super(message);
    this.name = "SkillSyncError";
    this.exitCode = exitCode;
  }
}

export class ValidationError extends SkillSyncError {
  constructor(message: string) {
    super(2, message);
    this.name = "ValidationError";
  }
}

export class PathRefusedError extends SkillSyncError {
  constructor(message: string) {
    super(3, message);
    this.name = "PathRefusedError";
  }
}
