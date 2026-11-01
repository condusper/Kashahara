import {
  CATALOG,
  CATALOG_NOTICE,
  CATALOG_VERSION,
  DATA_PLANS,
  DEFAULT_AIRTIME_FEE,
  getDataPlan,
  type AirtimeFee,
  type Catalog,
  type DataPlan,
  type Network,
} from '@kashahara/shared';
import { AppError } from '../errors';
import type { VtuProvider } from '../providers';

const LIVE_CATALOG_SUFFIX = '+';

/**
 * Resolves the product catalogue from the configured supplier.
 *
 * The bundled catalogue remains the offline/demo source. When the supplier
 * publishes live data plans, only those plans are offered so customers never
 * buy a demo bundle at a demo price with real money.
 */
export class CatalogService {
  constructor(
    private readonly provider: VtuProvider,
    private readonly airtimeFee: AirtimeFee = DEFAULT_AIRTIME_FEE,
  ) {}

  private get isLive(): boolean {
    return !this.provider.isSimulated && typeof this.provider.listDataPlans === 'function';
  }

  /** e.g. `2026.10+bigisub`, so cached clients can tell suppliers apart. */
  private get liveVersion(): string {
    return `${CATALOG_VERSION}${LIVE_CATALOG_SUFFIX}${this.provider.name}`;
  }

  async getDataPlans(): Promise<readonly DataPlan[]> {
    if (!this.provider.listDataPlans) return DATA_PLANS;
    try {
      return await this.provider.listDataPlans();
    } catch (error) {
      throw new AppError(
        503,
        'CATALOG_UNAVAILABLE',
        `Live data plans are temporarily unavailable. ${
          error instanceof Error ? error.message : 'Please try again shortly.'
        }`,
      );
    }
  }

  async getCatalog(): Promise<Catalog> {
    if (!this.isLive) return { ...CATALOG, airtimeFee: this.airtimeFee };
    try {
      const dataPlans = await this.getDataPlans();
      return {
        ...CATALOG,
        version: this.liveVersion,
        notice: `${CATALOG_NOTICE} Live supplier prices are shown; confirm the bundle before paying.`,
        dataPlans,
        airtimeFee: this.airtimeFee,
        isDemo: false,
      };
    } catch {
      // Do not fall back to the demo plans: they are not deliverable through
      // the live supplier. The app shows an empty, explicit state instead.
      return {
        ...CATALOG,
        version: this.liveVersion,
        notice: 'Live data plans are temporarily unavailable. Please try again shortly.',
        dataPlans: [],
        airtimeFee: this.airtimeFee,
        isDemo: false,
      };
    }
  }

  async findDataPlan(network: Network, planId: string): Promise<DataPlan | undefined> {
    if (!this.provider.listDataPlans) return getDataPlan(network, planId);
    const plans = await this.getDataPlans();
    return plans.find((plan) => plan.network === network && plan.id === planId);
  }
}
