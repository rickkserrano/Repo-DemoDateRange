import { Component } from '@angular/core';
import { DemoComponent } from './demo/demo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DemoComponent],
  template: `<app-demo />`,
})
export class AppComponent {}
