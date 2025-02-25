import { animate, style, transition, trigger } from '@angular/animations';

export const ENTER_ANIMATION = [
  trigger('enterAnimation', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('300ms', style({ opacity: 1 })),
    ]),
  ]),
];
