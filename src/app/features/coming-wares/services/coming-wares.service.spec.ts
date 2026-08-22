import { TestBed } from '@angular/core/testing';

import { ComingWaresService } from './coming-wares.service';

describe('ComingWaresService', () => {
  let service: ComingWaresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ComingWaresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
