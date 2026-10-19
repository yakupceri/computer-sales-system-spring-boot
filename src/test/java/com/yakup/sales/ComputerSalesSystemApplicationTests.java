package com.yakup.sales;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("h2") // MySQL gerektirmeden bellek içi H2 ile çalışır
class ComputerSalesSystemApplicationTests {

	@Test
	void contextLoads() {
	}

}
