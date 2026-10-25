package com.yakup.sales.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sipariş oluşturmayı uçtan uca test eder. Demo verisinde:
 * ürün 15 = Samsung 990 Pro SSD (6.499 ₺, bol stok), ürün 18 = Logitech C920 (stok 0).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class OrderControllerTest {

    private static final long SSD = 15;
    private static final long OUT_OF_STOCK_WEBCAM = 18;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createsOrderAndDecreasesStock() throws Exception {
        int before = stockOf(SSD);

        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":1,\"items\":[{\"productId\":15,\"quantity\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customer.id").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[0].price").value(6499.0))
                .andExpect(jsonPath("$.totalPrice").value(12998.0));

        assertThat(stockOf(SSD)).isEqualTo(before - 2);
    }

    @Test
    void mergesDuplicateProductLines() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":2,\"items\":[{\"productId\":15,\"quantity\":1},{\"productId\":15,\"quantity\":1}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].quantity").value(2));
    }

    @Test
    void rejectsInsufficientStockAndRollsBack() throws Exception {
        int before = stockOf(SSD);

        // SSD stokta var ama webcam yok: tüm sipariş reddedilmeli, SSD stoğu da değişmemeli
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":1,\"items\":[{\"productId\":15,\"quantity\":1},{\"productId\":18,\"quantity\":1}]}"))
                .andExpect(status().isConflict())
                .andExpect(status().reason(containsString("Yetersiz stok")));

        assertThat(stockOf(SSD)).isEqualTo(before);
        assertThat(stockOf(OUT_OF_STOCK_WEBCAM)).isZero();
    }

    @Test
    void rejectsUnknownCustomer() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":9999,\"items\":[{\"productId\":15,\"quantity\":1}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(status().reason(containsString("Müşteri bulunamadı")));
    }

    @Test
    void rejectsEmptyOrInvalidItems() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":1,\"items\":[]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":1,\"items\":[{\"productId\":15,\"quantity\":0}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getReturns404ForMissingOrder() throws Exception {
        mockMvc.perform(get("/api/orders/{id}", 99999)).andExpect(status().isNotFound());
    }

    private int stockOf(long productId) throws Exception {
        String json = mockMvc.perform(get("/api/products/{id}", productId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("stockQuantity").asInt();
    }
}
