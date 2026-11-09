package io.hexlet.calendar;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class FrontendController {
    @GetMapping("/meetings")
    public String meetingTypesCatalog() {
        return "forward:/index.html";
    }
}
