import { Entry } from "@napi-rs/keyring";
import { KeychainError } from "./core/errors.js";
import type { Provider } from "./core/skill.js";

const SERVICE = "skillsync";

export function getKey(provider: Provider): string | null {
  const entry = entryFor(provider);
  try {
    return entry.getPassword();
  } catch (err) {
    throw wrapKeychainError(
      `Couldn't read ${provider} key from the OS keychain.`,
      err,
    );
  }
}

export function setKey(provider: Provider, value: string): void {
  const entry = entryFor(provider);
  try {
    entry.setPassword(value);
  } catch (err) {
    throw wrapKeychainError(
      `Couldn't store ${provider} key in the OS keychain.`,
      err,
    );
  }
}

export function deleteKey(provider: Provider): boolean {
  const entry = entryFor(provider);
  try {
    return entry.deletePassword();
  } catch (err) {
    throw wrapKeychainError(
      `Couldn't delete ${provider} key from the OS keychain.`,
      err,
    );
  }
}

function entryFor(provider: Provider): Entry {
  try {
    return new Entry(SERVICE, provider);
  } catch (err) {
    throw wrapKeychainError(
      "No OS keychain available — skillsync needs a secret store to save API keys.",
      err,
    );
  }
}

function wrapKeychainError(message: string, cause: unknown): KeychainError {
  const err = new KeychainError(message);
  if (cause !== undefined) {
    (err as Error & { cause?: unknown }).cause = cause;
  }
  return err;
}
