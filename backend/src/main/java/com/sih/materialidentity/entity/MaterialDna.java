package com.sih.materialidentity.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class MaterialDna {

    @Column(name = "dna_category")
    private String category;

    @Column(name = "dna_type")
    private String type;

    @Column(name = "dna_material")
    private String material;

    @Column(name = "dna_grade")
    private String grade;

    @Column(name = "dna_diameter")
    private String diameter;

    @Column(name = "dna_length")
    private String length;

    @Column(name = "dna_size")
    private String size;

    @Column(name = "dna_pressure_rating")
    private String pressureRating;

    @Column(name = "dna_voltage")
    private String voltage;

    @Column(name = "dna_capacity")
    private String capacity;

    @Column(name = "dna_standard")
    private String standard;

    @Column(name = "dna_uom")
    private String uom;

    @Column(name = "dna_attributes_json", columnDefinition = "TEXT")
    private String attributesJson;
}
