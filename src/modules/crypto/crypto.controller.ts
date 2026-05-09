import { Controller, Get, Query } from "@nestjs/common";
import { CryptoQueryDto } from "./dto/crypto-query.dto";
import { CryptoService } from "./crypto.service";
import {
  CryptoAssetsResponse,
  CryptoEcosystemsResponse,
  CryptoFiltersResponse,
  CryptoOverviewResponse,
  CryptoTopMoversResponse,
} from "./crypto.types";

@Controller("crypto")
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Get("overview")
  getOverview(): Promise<CryptoOverviewResponse> {
    return this.cryptoService.getOverview();
  }

  @Get("ecosystems")
  getEcosystems(@Query() query: CryptoQueryDto): Promise<CryptoEcosystemsResponse> {
    return this.cryptoService.getEcosystems(query.limit ?? 3);
  }

  @Get("featured")
  getFeatured(@Query() query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    return this.cryptoService.getFeatured(query);
  }

  @Get("top-movers")
  getTopMovers(@Query() query: CryptoQueryDto): Promise<CryptoTopMoversResponse> {
    return this.cryptoService.getTopMovers(query);
  }

  @Get("trending")
  getTrending(@Query() query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    return this.cryptoService.getTrending(query);
  }

  @Get("all")
  getAll(@Query() query: CryptoQueryDto): Promise<CryptoAssetsResponse> {
    return this.cryptoService.getAll(query);
  }

  @Get("filters")
  getFilters(): Promise<CryptoFiltersResponse> {
    return this.cryptoService.getFilters();
  }
}
