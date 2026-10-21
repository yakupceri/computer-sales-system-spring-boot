package com.yakup.sales.service;

import com.yakup.sales.domain.Category;
import com.yakup.sales.repository.CategoryRepository;
import com.yakup.sales.specification.FiltersSpecification;
import com.yakup.sales.specification.IBaseFilterService;

import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CategoryService implements IBaseFilterService<Category, CategoryRepository> {

    private final CategoryRepository repo;
    private final FiltersSpecification<Category> filters;

    @Override public CategoryRepository getRepository() { return repo; }
    @Override public FiltersSpecification<Category> getFiltersSpecification() { return filters; }

    public List<Category> findAll() {
        return repo.findAll();
    }

    public Category findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kategori bulunamadı: " + id));
    }

    public Category create(Category category) {
        String name = category.getName().trim();
        if (repo.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu isimde bir kategori zaten var: " + name);
        }
        category.setId(null); // id'yi istemci değil veritabanı belirler
        category.setName(name);
        return repo.save(category);
    }

    public Category update(Long id, Category changes) {
        Category category = findById(id);
        String name = changes.getName().trim();
        if (repo.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu isimde bir kategori zaten var: " + name);
        }
        category.setName(name);
        category.setDescription(changes.getDescription());
        return repo.save(category);
    }

    public void delete(Long id) {
        Category category = findById(id);
        try {
            repo.delete(category);
        } catch (DataIntegrityViolationException e) {
            // products.category_id foreign key'i: kategoriye bağlı ürün varken silinemez
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bu kategoriye bağlı ürünler olduğu için silinemez: " + category.getName());
        }
    }
}
