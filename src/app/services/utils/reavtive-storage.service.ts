import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReactiveStorageService {
  private storageKeySubjects = new Map<
    string,
    BehaviorSubject<string | null>
  >();

  getValue$(key: string): Observable<string | null> {
    if (!this.storageKeySubjects.has(key)) {
      const storedValue = sessionStorage.getItem(key);
      this.storageKeySubjects.set(key, new BehaviorSubject(storedValue));
    }

    return this.storageKeySubjects.get(key)!.asObservable();
  }

  setValue(key: string, value: string): void {
    sessionStorage.setItem(key, value);
    this.getOrCreateSubject(key).next(value);
  }

  removeValue(key: string): void {
    sessionStorage.removeItem(key);
    this.getOrCreateSubject(key).next(null);
  }

  private getOrCreateSubject(key: string): BehaviorSubject<string | null> {
    if (!this.storageKeySubjects.has(key)) {
      this.storageKeySubjects.set(
        key,
        new BehaviorSubject<string | null>(null)
      );
    }
    return this.storageKeySubjects.get(key)!;
  }
}
