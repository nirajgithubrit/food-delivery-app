import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Chart, registerables } from "chart.js";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../shared/services/toast.service";

Chart.register(...registerables);

@Component({
  selector: "app-admin-analytics",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./admin-analytics.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnalyticsComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  @ViewChild("trendCanvas") trendCanvas?: ElementRef<HTMLCanvasElement>;

  readonly loading = signal(true);
  overview: Record<string, unknown> | null = null;

  fromDate = "";
  toDate = "";

  private chart: Chart<"line"> | null = null;

  get totals(): Record<string, number> | undefined {
    return this.overview?.["totals"] as Record<string, number> | undefined;
  }

  get topItems(): { name: string; qty: number; revenue: number }[] {
    const v = this.overview?.["topItems"];
    return Array.isArray(v) ? (v as { name: string; qty: number; revenue: number }[]) : [];
  }

  get peakHours(): { hour: number; orders: number }[] {
    const v = this.overview?.["peakHours"];
    return Array.isArray(v) ? (v as { hour: number; orders: number }[]) : [];
  }

  /** Hour bucket is already Asia/Kolkata from the API. */
  formatPeakHour(hour: number): string {
    const h = Math.floor(Number(hour)) % 24;
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:00 ${period}`;
  }

  ngAfterViewInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  load(): void {
    this.loading.set(true);
    const params: { from?: string; to?: string } = {};
    if (this.fromDate) params.from = this.fromDate;
    if (this.toDate) params.to = this.toDate;

    this.api.getAnalyticsOverview(params).subscribe({
      next: (data) => {
        this.overview = data as Record<string, unknown>;
        this.loading.set(false);
        setTimeout(() => this.renderTrend(), 0);
      },
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Could not load analytics";
        this.toast.error(msg);
        this.loading.set(false);
      },
    });
  }

  private renderTrend(): void {
    const canvas = this.trendCanvas?.nativeElement;
    if (!canvas || !this.overview) return;

    const daily = (this.overview["dailyTrend"] as { date: string; orders: number; revenue: number }[]) || [];
    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: daily.map((d) => d.date),
        datasets: [
          {
            label: "Orders",
            data: daily.map((d) => d.orders),
            borderColor: "rgb(249, 115, 22)",
            tension: 0.25,
            yAxisID: "y",
          },
          {
            label: "Revenue (₹)",
            data: daily.map((d) => d.revenue),
            borderColor: "rgb(59, 130, 246)",
            tension: 0.25,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { type: "linear", display: true, position: "left" },
          y1: { type: "linear", display: true, position: "right", grid: { drawOnChartArea: false } },
        },
      },
    });
  }
}
