import { Controller, Get, Query } from "@nestjs/common";
import { CompareQueryDto, CompareSearchQueryDto } from "./dto/compare-query.dto";
import { CompareService } from "./compare.service";
import { CompareResponse, CompareSearchResponse } from "./compare.types";

@Controller("compare")
export class CompareController {
  constructor(private readonly service: CompareService) {}

  @Get("search")
  searchAssets(@Query() query: CompareSearchQueryDto): Promise<CompareSearchResponse> {
    return this.service.search(query.q, query.limit ?? 30);
  }

  @Get()
  compare(@Query() query: CompareQueryDto): Promise<CompareResponse> {
    return this.service.compare(query.assets);
  }
}
