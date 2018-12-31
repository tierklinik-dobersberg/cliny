import { Plugin } from "@jsmon/core";
import { HolidayService } from "./nagar-date-api";
import { provideConfigKey } from "../config";

@Plugin({
    providers: [
        HolidayService,
        provideConfigKey('holidays')
    ]
})
export class HolidaysPlugin {
    constructor(_: HolidayService) {}
}