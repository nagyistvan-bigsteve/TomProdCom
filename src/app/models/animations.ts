import { animate, style, transition, trigger } from '@angular/animations';

export const ENTER_ANIMATION = [
  trigger('enterAnimation', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('600ms', style({ opacity: 1 })),
    ]),
  ]),
];

export const LEAVE_ANIMATION = [
  trigger('leaveAnimation', [
    transition(':leave', [
      style({ opacity: 1 }),
      animate('600ms', style({ opacity: 0 })),
    ]),
  ]),
];

export const ENTER_AND_LEAVE_ANIMATION = [
  trigger('enterAndLeaveAnimation', [
    transition(':leave', [
      style({ opacity: 1 }),
      animate('600ms', style({ opacity: 0 })),
    ]),
    transition(':enter', [
      style({ opacity: 0 }),
      animate('600ms', style({ opacity: 1 })),
    ]),
  ]),
];
