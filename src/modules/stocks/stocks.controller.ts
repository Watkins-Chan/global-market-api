import { Controller, Get, Query } from "@nestjs/common";
import { StocksQueryDto } from "./dto/stocks-query.dto";
import { StocksService } from "./stocks.service";
import {
  StocksAssetsResponse,
  StocksCountriesResponse,
  StocksFiltersResponse,
  StocksOverviewResponse,
  StocksTopMoversResponse,
} from "./stocks.types";

@Controller("stocks")
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get("overview")
  getOverview(@Query() query: StocksQueryDto): Promise<StocksOverviewResponse> {
    return this.stocksService.getOverview(query);
  }

  @Get("featured")
  getFeatured(@Query() query: StocksQueryDto): Promise<StocksAssetsResponse> {
    return this.stocksService.getFeatured(query);
  }

  @Get("top-movers")
  getTopMovers(@Query() query: StocksQueryDto): Promise<StocksTopMoversResponse> {
    return this.stocksService.getTopMovers(query);
  }

  @Get("trending")
  getTrending(@Query() query: StocksQueryDto): Promise<StocksAssetsResponse> {
    return this.stocksService.getTrending(query);
  }

  @Get("all")
  getAllStocks(@Query() query: StocksQueryDto): Promise<StocksAssetsResponse> {
    return this.stocksService.getAllStocks(query);
  }

  @Get("filters")
  getFilters(@Query() query: StocksQueryDto): Promise<StocksFiltersResponse> {
    return this.stocksService.getFilters(query);
  }

  @Get("countries")
  getCountries(): Promise<StocksCountriesResponse> {
    return this.stocksService.getCountries();
  }

}
