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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Kategori uç noktalarını uygulamanın tamamı ayaktayken (H2 + demo verisi) test eder.
 * Her test kendi kategorisini oluşturur, böylece testler birbirini etkilemez.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createReturns201WithGeneratedId() throws Exception {
        mockMvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Tablet \",\"description\":\"Tablet bilgisayarlar\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.name").value("Tablet"));
    }

    @Test
    void createRejectsBlankName() throws Exception {
        mockMvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRejectsDuplicateNameIgnoringCase() throws Exception {
        // "Laptop" demo verisinde var
        mockMvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"laptop\"}"))
                .andExpect(status().isConflict())
                .andExpect(status().reason(containsString("zaten var")));
    }

    @Test
    void updateChangesNameAndDescription() throws Exception {
        long id = createCategory("Yazıcı");

        mockMvc.perform(put("/api/categories/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yazıcı & Tarayıcı\",\"description\":\"Ofis ürünleri\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.name").value("Yazıcı & Tarayıcı"))
                .andExpect(jsonPath("$.description").value("Ofis ürünleri"));
    }

    @Test
    void updateReturns404ForMissingCategory() throws Exception {
        mockMvc.perform(put("/api/categories/{id}", 99999).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yok\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteRemovesCategory() throws Exception {
        long id = createCategory("Silinecek Kategori");

        mockMvc.perform(delete("/api/categories/{id}", id))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/categories/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteReturns409WhenProductsUseCategory() throws Exception {
        // 1 numaralı kategori (Laptop) demo verisinde ürünlere bağlı
        mockMvc.perform(delete("/api/categories/{id}", 1))
                .andExpect(status().isConflict())
                .andExpect(status().reason(containsString("bağlı ürünler")));
    }

    private long createCategory(String name) throws Exception {
        String body = mockMvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", name))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(body);
        return json.get("id").asLong();
    }
}
