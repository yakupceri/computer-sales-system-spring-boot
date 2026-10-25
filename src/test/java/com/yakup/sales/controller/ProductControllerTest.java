package com.yakup.sales.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createReturns201WithCategory() throws Exception {
        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(body("Test Laptop", "TST-001", "15000.50", 5, 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.sku").value("TST-001"))
                .andExpect(jsonPath("$.category.name").value("Laptop"));
    }

    @Test
    void createRejectsDuplicateSku() throws Exception {
        // LT-TP-X1C demo verisinde var
        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(body("Kopya", "lt-tp-x1c", "100", 1, 1)))
                .andExpect(status().isConflict())
                .andExpect(status().reason(containsString("SKU")));
    }

    @Test
    void createRejectsInvalidFields() throws Exception {
        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"sku\":\"X\",\"price\":-5,\"stockQuantity\":-1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRejectsUnknownCategory() throws Exception {
        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(body("Yetim Ürün", "TST-404", "100", 1, 9999)))
                .andExpect(status().isBadRequest())
                .andExpect(status().reason(containsString("Kategori bulunamadı")));
    }

    @Test
    void updateChangesFields() throws Exception {
        long id = create("Güncellenecek", "TST-UPD");

        mockMvc.perform(put("/api/products/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(body("Güncellendi", "TST-UPD", "999.99", 12, 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Güncellendi"))
                .andExpect(jsonPath("$.price").value(999.99))
                .andExpect(jsonPath("$.stockQuantity").value(12))
                .andExpect(jsonPath("$.category.id").value(3));
    }

    @Test
    void deleteRemovesUnusedProduct() throws Exception {
        long id = create("Silinecek", "TST-DEL");

        mockMvc.perform(delete("/api/products/{id}", id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/products/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void deleteReturns409WhenProductWasSold() throws Exception {
        // 1 numaralı ürün demo siparişlerinde var
        mockMvc.perform(delete("/api/products/{id}", 1))
                .andExpect(status().isConflict());
    }

    private long create(String name, String sku) throws Exception {
        String json = mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(body(name, sku, "100", 3, 1)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }

    private String body(String name, String sku, String price, int stock, long categoryId) {
        return String.format(
                "{\"name\":\"%s\",\"sku\":\"%s\",\"price\":%s,\"stockQuantity\":%d,\"categoryId\":%d}",
                name, sku, price, stock, categoryId);
    }
}
